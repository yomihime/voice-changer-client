//! Native capabilities exposed only to the trusted main client window.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::HashSet, fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_opener::OpenerExt;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ShortcutRow {
    action: String,
    shortcut: String,
    display_name: String,
    description: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ShortcutConfig {
    enabled: bool,
    shortcuts: Vec<ShortcutRow>,
    #[serde(default, skip_deserializing, skip_serializing_if = "Option::is_none")]
    warning: Option<String>,
}

struct ShortcutSettingsState {
    config: Mutex<ShortcutConfig>,
    path: PathBuf,
}

const ACTIONS: [(&str, &str); 11] = [
    ("ShowStatus", "showStatus"),
    ("NextSlot", "nextSlot"),
    ("PreviousSlot", "previousSlot"),
    ("ToggleVoiceConversion", "toggleVoiceConversion"),
    ("TogglePassthrough", "togglePassthrough"),
    ("InputVolumeUp", "increaseInputVolume"),
    ("InputVolumeDown", "decreaseInputVolume"),
    ("OutputVolumeUp", "increaseOutputVolume"),
    ("OutputVolumeDown", "decreaseOutputVolume"),
    ("MonitorVolumeUp", "increaseMonitorVolume"),
    ("MonitorVolumeDown", "decreaseMonitorVolume"),
];

impl Default for ShortcutConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            warning: None,
            shortcuts: ACTIONS
                .iter()
                .enumerate()
                .map(|(index, (action, key))| ShortcutRow {
                    action: (*action).into(),
                    shortcut: format!("control+alt+shift+F{}", index + 1),
                    display_name: format!("common.shortcut_settings.actions.{key}.name"),
                    description: format!("common.shortcut_settings.actions.{key}.description"),
                })
                .collect(),
        }
    }
}

fn trusted_window(label: &str, url: &url::Url, expected_origin: &str) -> Result<(), String> {
    if label != "main" || url.origin().ascii_serialization() != expected_origin {
        return Err("Native commands are restricted to the trusted main client window".into());
    }
    Ok(())
}

pub fn authorize(app: &AppHandle, window: &WebviewWindow) -> Result<(), String> {
    let runtime = app.state::<crate::RuntimeState>();
    let url = window.url().map_err(|error| error.to_string())?;
    trusted_window(window.label(), &url, &runtime.origin)
}

fn shortcut_event(action: &str) -> Result<Value, String> {
    let volume = match action {
        "InputVolumeUp" => Some(("input", 0.1)),
        "InputVolumeDown" => Some(("input", -0.1)),
        "OutputVolumeUp" => Some(("output", 0.1)),
        "OutputVolumeDown" => Some(("output", -0.1)),
        "MonitorVolumeUp" => Some(("monitor", 0.1)),
        "MonitorVolumeDown" => Some(("monitor", -0.1)),
        "ShowStatus"
        | "NextSlot"
        | "PreviousSlot"
        | "ToggleVoiceConversion"
        | "TogglePassthrough" => None,
        _ => return Err(format!("Unknown shortcut action: {action}")),
    };
    Ok(match volume {
        Some((kind, delta)) => {
            json!({"action": "VolumeChange", "volumeType": kind, "delta": delta})
        }
        None => json!({"action": action}),
    })
}

fn validate_config(config: &ShortcutConfig) -> Result<(), String> {
    if config.shortcuts.len() > ACTIONS.len() {
        return Err("Too many shortcut actions".into());
    }
    let mut actions = HashSet::new();
    let mut keys = HashSet::new();
    for row in &config.shortcuts {
        shortcut_event(&row.action)?;
        if !actions.insert(&row.action) {
            return Err(format!("Duplicate shortcut action: {}", row.action));
        }
        if row.display_name.len() > 256 || row.description.len() > 1024 || row.shortcut.len() > 100
        {
            return Err("Shortcut text exceeds the supported length".into());
        }
        if row.shortcut.trim().is_empty() {
            continue;
        }
        let shortcut = row
            .shortcut
            .parse::<Shortcut>()
            .map_err(|error| format!("Invalid shortcut {}: {error}", row.shortcut))?;
        if !keys.insert(shortcut.id()) {
            return Err(format!("Duplicate shortcut: {}", row.shortcut));
        }
    }
    Ok(())
}

fn register_config(app: &AppHandle, config: &ShortcutConfig) -> Result<(), String> {
    if !config.enabled {
        return Ok(());
    }
    for row in &config.shortcuts {
        if row.shortcut.trim().is_empty() {
            continue;
        }
        let payload = shortcut_event(&row.action)?;
        app.global_shortcut()
            .on_shortcut(row.shortcut.as_str(), move |app, _, event| {
                if event.state == ShortcutState::Pressed {
                    // Re-check the destination: a shortcut must never target remote content.
                    if let Some(window) = app.get_webview_window("main") {
                        if authorize(app, &window).is_ok() {
                            let _ = app.emit_to("main", "shortcut-action", payload.clone());
                        }
                    }
                }
            })
            .map_err(|error| {
                format!("Cannot register {} ({}): {error}", row.shortcut, row.action)
            })?;
    }
    Ok(())
}

fn apply_config(
    previous: &ShortcutConfig,
    next: &ShortcutConfig,
    mut replace_registration: impl FnMut(&ShortcutConfig) -> Result<(), String>,
    persist: impl FnOnce(&ShortcutConfig) -> Result<(), String>,
) -> Result<(), String> {
    if let Err(original_error) = replace_registration(next).and_then(|_| persist(next)) {
        return Err(match replace_registration(previous) {
            Ok(()) => format!("{original_error}; previous shortcut settings restored"),
            Err(rollback) => {
                format!("{original_error}; restoring previous shortcuts also failed: {rollback}")
            }
        });
    }
    Ok(())
}

fn save_config(path: &std::path::Path, config: &ShortcutConfig) -> Result<(), String> {
    let parent = path.parent().ok_or("Invalid shortcut settings directory")?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let temporary = path.with_extension("json.tmp");
    let contents = serde_json::to_vec_pretty(config).map_err(|error| error.to_string())?;
    fs::write(&temporary, contents)
        .map_err(|error| format!("Cannot write shortcut settings: {error}"))?;
    fs::rename(&temporary, path)
        .map_err(|error| format!("Cannot replace shortcut settings: {error}"))
}

/// Install state after RuntimeState and both plugins have been registered.
pub fn initialize(app: &AppHandle) -> Result<(), String> {
    let path = app
        .state::<crate::RuntimeState>()
        .profile_dir
        .join("shortcut-settings.json");
    let load = || -> Result<ShortcutConfig, String> {
        if !path.exists() {
            return Ok(ShortcutConfig::default());
        }
        let content =
            fs::read(&path).map_err(|error| format!("Cannot read shortcut settings: {error}"))?;
        let config = serde_json::from_slice::<ShortcutConfig>(&content)
            .map_err(|error| format!("Invalid shortcut settings: {error}"))?;
        validate_config(&config)?;
        Ok(config)
    };
    // A corrupt preference or a shortcut occupied by another app must not stop
    // the client from opening. Keep the saved file untouched until the user edits.
    let mut config = load().unwrap_or_else(|error| ShortcutConfig {
        warning: Some(error),
        ..ShortcutConfig::default()
    });
    if let Err(error) = register_config(app, &config) {
        let cleanup = app.global_shortcut().unregister_all();
        config.enabled = false;
        config.warning = Some(match cleanup {
            Ok(()) => format!("Global shortcuts disabled: {error}"),
            Err(cleanup_error) => {
                format!("Global shortcuts failed: {error}; cleanup failed: {cleanup_error}")
            }
        });
    }
    app.manage(ShortcutSettingsState {
        config: Mutex::new(config),
        path,
    });
    Ok(())
}

#[tauri::command]
pub fn get_shortcut_settings(
    app: AppHandle,
    window: WebviewWindow,
) -> Result<ShortcutConfig, String> {
    authorize(&app, &window)?;
    let state = app.state::<ShortcutSettingsState>();
    let result = state
        .config
        .lock()
        .map_err(|_| "Shortcut settings lock is poisoned")?
        .clone();
    Ok(result)
}

#[tauri::command]
pub fn update_shortcut_settings(
    app: AppHandle,
    window: WebviewWindow,
    config_dto: ShortcutConfig,
) -> Result<(), String> {
    authorize(&app, &window)?;
    validate_config(&config_dto)?;
    let state = app.state::<ShortcutSettingsState>();
    let mut previous = state
        .config
        .lock()
        .map_err(|_| "Shortcut settings lock is poisoned")?;
    if *previous == config_dto {
        return Ok(());
    }
    apply_config(
        &previous,
        &config_dto,
        |config| {
            app.global_shortcut()
                .unregister_all()
                .map_err(|error| error.to_string())?;
            register_config(&app, config)
        },
        |config| save_config(&state.path, config),
    )?;
    *previous = config_dto;
    Ok(())
}

#[tauri::command]
pub fn register_shortcuts(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    authorize(&app, &window)?;
    // Updates and startup already register atomically. Keep the recovered client's
    // second call idempotent instead of briefly unregistering active shortcuts.
    Ok(())
}

fn validated_browser_url(value: &str) -> Result<url::Url, String> {
    if value.len() > 8192 {
        return Err("Browser URL is too long".into());
    }
    let url = url::Url::parse(value).map_err(|error| error.to_string())?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Only HTTPS links without credentials are supported".into());
    }
    Ok(url)
}

#[tauri::command]
pub fn open_browser_url(app: AppHandle, window: WebviewWindow, url: String) -> Result<(), String> {
    authorize(&app, &window)?;
    let url = validated_browser_url(&url)?;
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn show_notification_window_with_message(
    app: AppHandle,
    window: WebviewWindow,
    params: Value,
) -> Result<(), String> {
    authorize(&app, &window)?;
    if !params.is_object() || params.to_string().len() > 16384 {
        return Err("Invalid notification payload".into());
    }
    // The client displays a text-only toast. This is deliberately an in-app
    // notification, not a claim to implement the original desktop overlay.
    app.emit_to("main", "native-notification", params)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_disabled_and_all_actions_are_editable() {
        let config = ShortcutConfig::default();
        assert!(!config.enabled);
        assert_eq!(config.shortcuts.len(), 11);
        validate_config(&config).unwrap();
    }

    #[test]
    fn shortcut_validation_handles_browser_key_codes_and_normalized_duplicates() {
        let mut config = ShortcutConfig::default();
        for key in ["control+shift+KeyA", "alt+Digit1", "ArrowUp", "Space"] {
            config.shortcuts[0].shortcut = key.into();
            validate_config(&config).unwrap();
        }
        config.shortcuts[0].shortcut = "control+shift+KeyA".into();
        config.shortcuts[1].shortcut = "shift+control+KeyA".into();
        assert!(validate_config(&config)
            .unwrap_err()
            .contains("Duplicate shortcut"));
        config.shortcuts[1].shortcut = "unknown+garbage".into();
        assert!(validate_config(&config).is_err());
    }

    #[test]
    fn actions_are_closed_and_unique() {
        let mut config = ShortcutConfig::default();
        config.shortcuts[0].action = "ExecuteProcess".into();
        assert!(validate_config(&config).is_err());
        config.shortcuts[0].action = "NextSlot".into();
        assert!(validate_config(&config).is_err());
    }

    #[test]
    fn volume_rows_emit_the_recovered_client_protocol() {
        assert_eq!(
            shortcut_event("MonitorVolumeDown").unwrap(),
            json!({"action": "VolumeChange", "volumeType": "monitor", "delta": -0.1})
        );
        assert_eq!(
            shortcut_event("ShowStatus").unwrap(),
            json!({"action": "ShowStatus"})
        );
    }

    #[test]
    fn failed_registration_rolls_back_without_persisting() {
        let previous = ShortcutConfig::default();
        let mut next = previous.clone();
        next.enabled = true;
        let mut calls = Vec::new();
        let error = apply_config(
            &previous,
            &next,
            |config| {
                calls.push(config.enabled);
                if config.enabled {
                    Err("Shortcut is occupied".into())
                } else {
                    Ok(())
                }
            },
            |_| panic!("failed registration must not be saved"),
        )
        .unwrap_err();
        assert_eq!(calls, [true, false]);
        assert!(error.contains("previous shortcut settings restored"));
    }

    #[test]
    fn failed_persistence_rolls_back_and_reports_failed_recovery() {
        let previous = ShortcutConfig::default();
        let mut next = previous.clone();
        next.enabled = true;
        let error = apply_config(
            &previous,
            &next,
            |config| {
                if config.enabled {
                    Ok(())
                } else {
                    Err("Cannot restore old shortcut".into())
                }
            },
            |_| Err("Disk is full".into()),
        )
        .unwrap_err();
        assert!(error.contains("Disk is full"));
        assert!(error.contains("restoring previous shortcuts also failed"));
    }

    #[test]
    fn native_commands_require_exact_main_origin() {
        let origin = "http://127.0.0.1:12345";
        let url = url::Url::parse("http://127.0.0.1:12345/?app_mode=Main").unwrap();
        assert!(trusted_window("main", &url, origin).is_ok());
        assert!(trusted_window("logs", &url, origin).is_err());
        assert!(trusted_window("main", &url, "http://127.0.0.1:12346").is_err());
        assert!(trusted_window(
            "main",
            &url::Url::parse("https://example.com/").unwrap(),
            origin
        )
        .is_err());
    }

    #[test]
    fn browser_opener_rejects_local_files_and_custom_protocols() {
        assert!(validated_browser_url("https://github.com/yomihime/voice-changer-client").is_ok());
        for value in [
            "file:///C:/Windows/System32/cmd.exe",
            "javascript:alert(1)",
            "http://example.com",
            "https://user:password@example.com/",
        ] {
            assert!(validated_browser_url(value).is_err());
        }
    }

    #[test]
    fn settings_replace_existing_file_without_losing_json() {
        let directory =
            std::env::temp_dir().join(format!("voice-changer-shortcuts-{}", std::process::id()));
        let path = directory.join("shortcut-settings.json");
        let mut config = ShortcutConfig::default();
        save_config(&path, &config).unwrap();
        config.enabled = true;
        save_config(&path, &config).unwrap();
        assert_eq!(
            serde_json::from_slice::<ShortcutConfig>(&fs::read(&path).unwrap()).unwrap(),
            config
        );
        fs::remove_file(&path).unwrap();
        fs::remove_dir(&directory).unwrap();
    }
}
