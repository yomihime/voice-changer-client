//! Stable native preferences shared by every internal page-server origin.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs,
    io::Write,
    path::Path,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};
use tauri::{AppHandle, Manager, WebviewWindow};

const PROFILE_FILE: &str = "connection-profile.json";
const MAX_PROFILE_BYTES: usize = 4 * 1024 * 1024;
static NEXT_WRITE: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
struct StoredProfile {
    schema_version: u32,
    #[serde(default)]
    manual_address: String,
    #[serde(default)]
    settings: Option<Value>,
    #[serde(default)]
    legacy_migration_complete: bool,
}

impl Default for StoredProfile {
    fn default() -> Self {
        Self {
            schema_version: 1,
            manual_address: String::new(),
            settings: None,
            legacy_migration_complete: false,
        }
    }
}

#[derive(Serialize)]
pub struct ConnectionProfile {
    schema_version: u32,
    manual_address: String,
    settings: Option<Value>,
    offline: bool,
    migration_state: String,
    migration_error: Option<String>,
}

struct MigrationStatus {
    phase: &'static str,
    error: Option<String>,
}

pub struct ConnectionState {
    lock: Mutex<()>,
    prefill: Option<String>,
    offline: bool,
    migration: Mutex<MigrationStatus>,
    migration_flight: tokio::sync::Mutex<()>,
}

impl ConnectionState {
    pub fn new(prefill: Option<String>, offline: bool) -> Result<Self, String> {
        let prefill = prefill
            .map(|address| {
                crate::server::parse_backend(&address)
                    .map(|url| url.to_string())
                    .map_err(|error| error.to_string())
            })
            .transpose()?;
        Ok(Self {
            lock: Mutex::new(()),
            prefill,
            offline,
            migration: Mutex::new(MigrationStatus {
                phase: "not_required",
                error: None,
            }),
            migration_flight: tokio::sync::Mutex::new(()),
        })
    }

    pub fn initialize(&self, directory: &Path) {
        let result =
            read_profile(directory).and_then(|profile| migration_required(directory, &profile));
        let status = match result {
            Ok(true) => MigrationStatus {
                phase: "pending",
                error: None,
            },
            Ok(false) => MigrationStatus {
                phase: "not_required",
                error: None,
            },
            Err(_) => MigrationStatus {
                phase: "failed",
                error: Some(
                    "Saved settings could not be inspected. Original data is preserved.".into(),
                ),
            },
        };
        *self.migration.lock().unwrap() = status;
    }
}

fn migration_required(directory: &Path, profile: &StoredProfile) -> Result<bool, String> {
    if profile.settings.is_some() || profile.legacy_migration_complete {
        return Ok(false);
    }
    crate::migration::legacy_storage_exists(directory)
}

fn read_ready_profile(
    state: &ConnectionState,
    directory: &Path,
) -> Result<Option<StoredProfile>, String> {
    let profile = read_profile(directory)?;
    if migration_required(directory, &profile)? {
        return Ok(None);
    }
    *state
        .migration
        .lock()
        .map_err(|_| "Settings migration lock is poisoned")? = MigrationStatus {
        phase: if profile.settings.is_some() || profile.legacy_migration_complete {
            "complete"
        } else {
            "not_required"
        },
        error: None,
    };
    Ok(Some(profile))
}

fn ensure_settings_write_allowed(
    directory: &Path,
    profile: &StoredProfile,
    status: &MigrationStatus,
) -> Result<(), String> {
    if matches!(status.phase, "pending" | "running" | "failed")
        || migration_required(directory, profile)?
    {
        return Err("Saved settings must be recovered before new settings can be saved. Retry the connection page.".into());
    }
    Ok(())
}

fn read_profile(directory: &Path) -> Result<StoredProfile, String> {
    let path = directory.join(PROFILE_FILE);
    let content = match fs::read(&path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(StoredProfile::default())
        }
        Err(error) => return Err(format!("Cannot read connection profile: {error}")),
    };
    if content.len() > MAX_PROFILE_BYTES {
        return Err("Connection profile exceeds the supported size".into());
    }
    let mut profile: StoredProfile = serde_json::from_slice(&content)
        .map_err(|error| format!("Invalid connection profile: {error}"))?;
    if profile.schema_version != 1 {
        return Err(format!(
            "Unsupported connection profile schema {}",
            profile.schema_version
        ));
    }
    if !profile.manual_address.is_empty() {
        profile.manual_address = crate::server::parse_backend(&profile.manual_address)
            .map_err(|error| error.to_string())?
            .to_string();
    }
    Ok(profile)
}

fn write_profile(directory: &Path, profile: &StoredProfile) -> Result<(), String> {
    let content = serde_json::to_vec_pretty(profile).map_err(|error| error.to_string())?;
    if content.len() > MAX_PROFILE_BYTES {
        return Err("Connection profile exceeds the supported size".into());
    }
    fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    let temporary = directory.join(format!(
        "connection-profile-{}-{}.tmp",
        std::process::id(),
        NEXT_WRITE.fetch_add(1, Ordering::Relaxed)
    ));
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|error| format!("Cannot create connection profile: {error}"))?;
    let result = file.write_all(&content).and_then(|_| file.sync_all());
    drop(file);
    let result = result.and_then(|_| fs::rename(&temporary, directory.join(PROFILE_FILE)));
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result.map_err(|error| format!("Cannot save connection profile: {error}"))
}

pub fn clear_global_settings(directory: &Path) -> Result<(), String> {
    let mut profile = read_profile(directory)?;
    if profile.settings.is_some() || !profile.legacy_migration_complete {
        profile.settings = None;
        profile.legacy_migration_complete = true;
        write_profile(directory, &profile)?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_connection_profile(
    app: AppHandle,
    window: WebviewWindow,
) -> Result<ConnectionProfile, String> {
    crate::commands::authorize(&app, &window)?;
    let state = app.state::<ConnectionState>();
    let _lock = state
        .lock
        .lock()
        .map_err(|_| "Connection profile lock is poisoned")?;
    let runtime = app.state::<crate::RuntimeState>();
    let profile = read_profile(&runtime.profile_dir)?;
    let migration = state
        .migration
        .lock()
        .map_err(|_| "Settings migration lock is poisoned")?;
    Ok(ConnectionProfile {
        schema_version: profile.schema_version,
        manual_address: state.prefill.clone().unwrap_or(profile.manual_address),
        settings: profile.settings,
        offline: state.offline,
        migration_state: migration.phase.into(),
        migration_error: migration.error.clone(),
    })
}

#[tauri::command]
pub fn configure_backend(
    app: AppHandle,
    window: WebviewWindow,
    address: String,
    remember: bool,
) -> Result<crate::server::BackendConnection, String> {
    crate::commands::authorize(&app, &window)?;
    let state = app.state::<ConnectionState>();
    let _lock = state
        .lock
        .lock()
        .map_err(|_| "Connection profile lock is poisoned")?;
    let runtime = app.state::<crate::RuntimeState>();
    let server = runtime
        .server
        .lock()
        .map_err(|_| "Page server lock is poisoned")?;
    let server = server.as_ref().ok_or("Client is closing")?;
    server.configure_with(&address, |normalized| {
        if remember {
            let mut profile = read_profile(&runtime.profile_dir)?;
            profile.manual_address = normalized.to_owned();
            write_profile(&runtime.profile_dir, &profile)?;
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn load_global_settings(
    app: AppHandle,
    window: WebviewWindow,
) -> Result<Option<Value>, String> {
    crate::commands::authorize(&app, &window)?;
    let state = app.state::<ConnectionState>();
    let _flight = state.migration_flight.lock().await;
    let directory = app.state::<crate::RuntimeState>().profile_dir.clone();
    {
        let _lock = state
            .lock
            .lock()
            .map_err(|_| "Connection profile lock is poisoned")?;
        if let Some(profile) = read_ready_profile(&state, &directory)? {
            return Ok(profile.settings);
        }
        *state
            .migration
            .lock()
            .map_err(|_| "Settings migration lock is poisoned")? = MigrationStatus {
            phase: "running",
            error: None,
        };
    }
    let result = crate::migration::read_legacy_settings(&app, &directory).await;
    let _lock = state
        .lock
        .lock()
        .map_err(|_| "Connection profile lock is poisoned")?;
    let result = result.and_then(|settings| {
        let mut profile = read_profile(&directory)?;
        if profile.settings.is_none() {
            profile.settings = settings;
        }
        profile.legacy_migration_complete = true;
        write_profile(&directory, &profile)?;
        Ok(profile.settings)
    });
    let mut migration = state
        .migration
        .lock()
        .map_err(|_| "Settings migration lock is poisoned")?;
    *migration = match &result {
        Ok(_) => MigrationStatus {
            phase: "complete",
            error: None,
        },
        Err(error) => MigrationStatus {
            phase: "failed",
            error: Some(error.clone()),
        },
    };
    // Persistence completes before closing the bridge, including on the empty-DB path.
    crate::migration::close_bridge(&app);
    result
}

#[tauri::command]
pub fn save_global_settings(
    app: AppHandle,
    window: WebviewWindow,
    settings: Value,
) -> Result<(), String> {
    crate::commands::authorize(&app, &window)?;
    let state = app.state::<ConnectionState>();
    let _lock = state
        .lock
        .lock()
        .map_err(|_| "Connection profile lock is poisoned")?;
    let runtime = app.state::<crate::RuntimeState>();
    let mut profile = read_profile(&runtime.profile_dir)?;
    let migration = state
        .migration
        .lock()
        .map_err(|_| "Settings migration lock is poisoned")?;
    ensure_settings_write_allowed(&runtime.profile_dir, &profile, &migration)?;
    profile.settings = Some(settings);
    write_profile(&runtime.profile_dir, &profile)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_roundtrip_preserves_raw_settings_and_existing_webview_data() {
        let directory = std::env::temp_dir().join(format!(
            "vcc-connection-profile-{}-{}",
            std::process::id(),
            NEXT_WRITE.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(directory.join("webview")).unwrap();
        fs::write(
            directory.join("webview/existing-indexeddb"),
            b"keep original data",
        )
        .unwrap();
        assert_eq!(read_profile(&directory).unwrap(), StoredProfile::default());
        let mut profile = StoredProfile {
            manual_address: "http://localhost:18888/voice/".into(),
            settings: Some(
                serde_json::json!({"device": null, "gain": 0, "nested": [false, "raw"]}),
            ),
            ..StoredProfile::default()
        };
        write_profile(&directory, &profile).unwrap();
        profile.manual_address = "https://server.local/".into();
        write_profile(&directory, &profile).unwrap();
        assert_eq!(read_profile(&directory).unwrap(), profile);
        assert_eq!(
            fs::read(directory.join("webview/existing-indexeddb")).unwrap(),
            b"keep original data"
        );
        clear_global_settings(&directory).unwrap();
        profile.settings = None;
        profile.legacy_migration_complete = true;
        assert_eq!(read_profile(&directory).unwrap(), profile);
        fs::remove_file(directory.join(PROFILE_FILE)).unwrap();
        fs::remove_file(directory.join("webview/existing-indexeddb")).unwrap();
        fs::remove_dir(directory.join("webview")).unwrap();
        fs::remove_dir(directory).unwrap();
    }

    #[test]
    fn future_or_corrupt_profiles_remain_untouched() {
        let directory = std::env::temp_dir().join(format!(
            "vcc-invalid-profile-{}-{}",
            std::process::id(),
            NEXT_WRITE.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&directory).unwrap();
        let path = directory.join(PROFILE_FILE);
        for raw in [b"not json".as_slice(), b"{\"schema_version\":2}".as_slice()] {
            fs::write(&path, raw).unwrap();
            assert!(read_profile(&directory).is_err());
            assert_eq!(fs::read(&path).unwrap(), raw);
        }
        fs::remove_file(path).unwrap();
        fs::remove_dir(directory).unwrap();
    }

    #[test]
    fn original_origin_storage_blocks_defaults_until_migration_completes() {
        let directory = std::env::temp_dir().join(format!(
            "vcc-migration-guard-{}-{}",
            std::process::id(),
            NEXT_WRITE.fetch_add(1, Ordering::Relaxed)
        ));
        let original = directory
            .join("webview/EBWebView/Default/IndexedDB/http_127.0.0.1_21416.indexeddb.leveldb");
        fs::create_dir_all(&original).unwrap();
        fs::write(
            original.join("retained-evidence"),
            b"original settings remain",
        )
        .unwrap();
        let state = ConnectionState::new(None, false).unwrap();
        state.initialize(&directory);
        assert_eq!(state.migration.lock().unwrap().phase, "pending");
        let mut profile = read_profile(&directory).unwrap();
        assert!(ensure_settings_write_allowed(
            &directory,
            &profile,
            &state.migration.lock().unwrap()
        )
        .is_err());
        for phase in ["running", "failed"] {
            assert!(ensure_settings_write_allowed(
                &directory,
                &profile,
                &MigrationStatus { phase, error: None }
            )
            .is_err());
        }
        profile.settings = Some(serde_json::json!({"savedDevice": "original-device", "gain": 0}));
        profile.legacy_migration_complete = true;
        write_profile(&directory, &profile).unwrap();
        assert!(ensure_settings_write_allowed(
            &directory,
            &profile,
            &MigrationStatus {
                phase: "complete",
                error: None
            }
        )
        .is_ok());
        assert_eq!(
            fs::read(original.join("retained-evidence")).unwrap(),
            b"original settings remain"
        );
        fs::remove_file(original.join("retained-evidence")).unwrap();
        fs::remove_dir(&original).unwrap();
        for parent in [
            "webview/EBWebView/Default/IndexedDB",
            "webview/EBWebView/Default",
            "webview/EBWebView",
            "webview",
        ] {
            fs::remove_dir(directory.join(parent)).unwrap();
        }
        fs::remove_file(directory.join(PROFILE_FILE)).unwrap();
        fs::remove_dir(directory).unwrap();
    }

    #[test]
    fn failed_migration_retry_reads_restored_settings_and_reenables_saving() {
        for recovered_settings in [
            Some(serde_json::json!({"device": "recovered", "gain": 0})),
            None,
        ] {
            let directory = std::env::temp_dir().join(format!(
                "vcc-migration-retry-{}-{}",
                std::process::id(),
                NEXT_WRITE.fetch_add(1, Ordering::Relaxed)
            ));
            let original =
                directory.join("webview/Default/IndexedDB/http_127.0.0.1_21416.indexeddb.leveldb");
            fs::create_dir_all(&original).unwrap();
            let state = ConnectionState::new(None, false).unwrap();
            state.initialize(&directory);
            assert_eq!(state.migration.lock().unwrap().phase, "pending");
            *state.migration.lock().unwrap() = MigrationStatus {
                phase: "failed",
                error: Some("previous migration error".into()),
            };
            let profile = StoredProfile {
                settings: recovered_settings.clone(),
                ..StoredProfile::default()
            };
            write_profile(&directory, &profile).unwrap();
            if recovered_settings.is_none() {
                fs::remove_dir(&original).unwrap();
            }
            assert!(ensure_settings_write_allowed(
                &directory,
                &profile,
                &state.migration.lock().unwrap()
            )
            .is_err());
            let mut recovered = read_ready_profile(&state, &directory).unwrap().unwrap();
            assert_eq!(recovered.settings, recovered_settings);
            {
                let status = state.migration.lock().unwrap();
                assert_eq!(
                    status.phase,
                    if recovered_settings.is_some() {
                        "complete"
                    } else {
                        "not_required"
                    }
                );
                assert!(status.error.is_none());
                ensure_settings_write_allowed(&directory, &recovered, &status).unwrap();
            }
            recovered.settings = Some(serde_json::json!({"device": "edited-after-recovery"}));
            write_profile(&directory, &recovered).unwrap();
            assert_eq!(
                read_profile(&directory).unwrap().settings,
                recovered.settings
            );
            if recovered_settings.is_some() {
                fs::remove_dir(&original).unwrap();
            }
            for parent in ["webview/Default/IndexedDB", "webview/Default", "webview"] {
                fs::remove_dir(directory.join(parent)).unwrap();
            }
            fs::remove_file(directory.join(PROFILE_FILE)).unwrap();
            fs::remove_dir(directory).unwrap();
        }
    }
}
