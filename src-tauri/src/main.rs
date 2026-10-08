#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod commands;
mod profile;
mod server;

use std::{path::PathBuf, sync::Mutex};
use tauri::webview::{NewWindowResponse, PermissionKind, PermissionResponse};
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

#[derive(Debug)]
struct Options {
    backend: Option<String>,
    port: u16,
    profile_dir: Option<PathBuf>,
    hidden: bool,
    deny_media: bool,
}

impl Options {
    fn parse(args: impl IntoIterator<Item = String>) -> Result<Self, String> {
        let mut result = Self {
            backend: Some("http://127.0.0.1:18000/".into()),
            port: 21416,
            profile_dir: None,
            hidden: false,
            deny_media: false,
        };
        let mut args = args.into_iter();
        let mut seen = std::collections::HashSet::new();
        while let Some(arg) = args.next() {
            if !seen.insert(arg.clone()) {
                return Err(format!("Duplicate option: {arg}"));
            }
            match arg.as_str() {
                "--offline" => result.backend = None,
                "--hidden" => result.hidden = true,
                "--deny-media" => result.deny_media = true,
                "--backend" => result.backend = Some(args.next().ok_or("Missing --backend URL")?),
                "--port" => {
                    result.port = args
                        .next()
                        .ok_or("Missing --port")?
                        .parse()
                        .map_err(|_| "Invalid port")?
                }
                "--profile-dir" => {
                    let path = PathBuf::from(args.next().ok_or("Missing --profile-dir")?);
                    if !path.is_absolute() {
                        return Err("Profile directory must be absolute".into());
                    }
                    result.profile_dir = Some(path);
                }
                _ => return Err(format!("Unknown option: {arg}")),
            }
        }
        if seen.contains("--offline") && seen.contains("--backend") {
            return Err("Choose --offline or --backend".into());
        }
        if result.hidden && !result.deny_media {
            return Err("--hidden requires --deny-media".into());
        }
        Ok(result)
    }
}

pub struct RuntimeState {
    pub origin: String,
    pub profile_dir: PathBuf,
    pub hidden: bool,
    pub deny_media: bool,
    server: Mutex<Option<server::RunningServer>>,
}

pub fn authorize_main(window: &WebviewWindow, state: &RuntimeState) -> Result<(), String> {
    if window.label() != "main"
        || window
            .url()
            .map_err(|e| e.to_string())?
            .origin()
            .ascii_serialization()
            != state.origin
    {
        return Err("This command is only available to the main client window".into());
    }
    Ok(())
}

fn navigation_allowed(url: &url::Url, origin: &str) -> bool {
    url.origin().ascii_serialization() == origin
        && url.username().is_empty()
        && url.password().is_none()
        && matches!(url.path(), "/" | "/index.html")
}

fn open_window(app: &tauri::AppHandle, label: &str) -> tauri::Result<WebviewWindow> {
    let state = app.state::<RuntimeState>();
    let is_main = label == "main";
    let address = format!(
        "{}/{}",
        state.origin,
        if is_main { "" } else { "?app_mode=LogViewer" }
    );
    let allowed_origin = state.origin.clone();
    let deny_media = state.deny_media || !is_main;
    let window =
        WebviewWindowBuilder::new(app, label, WebviewUrl::External(address.parse().unwrap()))
            .title(if is_main {
                "Voice Changer Client · Tauri Preview"
            } else {
                "Voice Changer Client · Logs"
            })
            .inner_size(1280.0, 960.0)
            .min_inner_size(800.0, 600.0)
            .visible(!state.hidden)
            .focused(!state.hidden)
            .data_directory(state.profile_dir.join("webview"))
            .disable_drag_drop_handler()
            .on_navigation(move |url| navigation_allowed(url, &allowed_origin))
            .on_new_window(|_, _| NewWindowResponse::Deny)
            .on_permission_request(move |_, kind| {
                if !deny_media && matches!(kind, PermissionKind::Microphone) {
                    PermissionResponse::Default
                } else {
                    PermissionResponse::Deny
                }
            })
            .build()?;
    if is_main {
        let handle = app.clone();
        window.on_window_event(move |event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                handle.exit(0);
            }
        });
    }
    Ok(window)
}

#[tauri::command]
async fn open_log_window(
    app: tauri::AppHandle,
    window: WebviewWindow,
    state: tauri::State<'_, RuntimeState>,
) -> Result<(), String> {
    authorize_main(&window, &state)?;
    if let Some(logs) = app.get_webview_window("logs") {
        if !state.hidden {
            logs.show().map_err(|e| e.to_string())?;
            logs.set_focus().map_err(|e| e.to_string())?;
        }
        return Ok(());
    }
    open_window(&app, "logs").map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn set_clear_site_data_and_stop_app(
    app: tauri::AppHandle,
    window: WebviewWindow,
    state: tauri::State<'_, RuntimeState>,
) -> Result<(), String> {
    authorize_main(&window, &state)?;
    // WebView2 clears browsing data asynchronously. Mark a reset and perform it
    // before creating the next WebView, once this process has released its files.
    profile::request_reset(&state.profile_dir)?;
    // Stop only this client; the independently managed inference service stays running.
    app.exit(0);
    Ok(())
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let options = Options::parse(std::env::args().skip(1))?;
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            open_log_window,
            set_clear_site_data_and_stop_app,
            commands::get_shortcut_settings,
            commands::update_shortcut_settings,
            commands::register_shortcuts,
            commands::open_browser_url,
            commands::show_notification_window_with_message
        ])
        .setup(move |app| {
            let profile_dir = options
                .profile_dir
                .clone()
                .unwrap_or(app.path().app_data_dir()?);
            std::fs::create_dir_all(&profile_dir)?;
            profile::apply_pending_reset(&profile_dir).map_err(std::io::Error::other)?;
            let server = tauri::async_runtime::block_on(server::start(
                options.port,
                options.backend.clone(),
            ))
            .map_err(|e| std::io::Error::other(e.to_string()))?;
            app.manage(RuntimeState {
                origin: server.origin.clone(),
                profile_dir,
                hidden: options.hidden,
                deny_media: options.deny_media,
                server: Mutex::new(Some(server)),
            });
            commands::initialize(app.handle()).map_err(std::io::Error::other)?;
            open_window(app.handle(), "main")?;
            Ok(())
        })
        .build(tauri::generate_context!())?;
    app.run(|handle, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            if let Some(state) = handle.try_state::<RuntimeState>() {
                if let Ok(mut server) = state.server.lock() {
                    if let Some(server) = server.take() {
                        tauri::async_runtime::block_on(server.wait());
                    }
                }
            }
        }
    });
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("Voice Changer Client: {error}");
        #[cfg(windows)]
        unsafe {
            #[link(name = "user32")]
            extern "system" {
                fn MessageBoxW(
                    hwnd: isize,
                    text: *const u16,
                    caption: *const u16,
                    flags: u32,
                ) -> i32;
            }
            let message: Vec<u16> = format!("Cannot start Voice Changer Client.\n\n{error}")
                .encode_utf16()
                .chain(Some(0))
                .collect();
            let title: Vec<u16> = "Voice Changer Client"
                .encode_utf16()
                .chain(Some(0))
                .collect();
            MessageBoxW(0, message.as_ptr(), title.as_ptr(), 0x10);
        }
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cli_rejects_hidden_media_and_ambiguous_configuration() {
        for args in [
            vec!["--hidden"],
            vec!["--offline", "--backend", "http://127.0.0.1:18000/"],
            vec!["--port", "4", "--port", "5"],
            vec!["--profile-dir", "relative"],
            vec!["--unknown"],
        ] {
            assert!(Options::parse(args.into_iter().map(str::to_string)).is_err());
        }
        assert!(
            Options::parse(["--hidden", "--deny-media", "--offline"].map(str::to_string)).is_ok()
        );
    }
    #[test]
    fn window_navigation_keeps_the_embedded_origin_and_document() {
        let origin = "http://127.0.0.1:21416";
        for path in ["/", "/?app_mode=LogViewer", "/index.html"] {
            assert!(navigation_allowed(
                &format!("{origin}{path}").parse().unwrap(),
                origin
            ));
        }
        for url in [
            "https://example.com/",
            "http://127.0.0.1:18000/",
            "http://127.0.0.1:21416/api/malicious.html",
            "http://user@127.0.0.1:21416/",
        ] {
            assert!(!navigation_allowed(&url.parse().unwrap(), origin));
        }
    }
}
