//! Read the original loopback origin through host-supplied content, without TCP.
use serde::Deserialize;
use serde_json::Value;
use std::{fs, path::Path};
use tauri::{AppHandle, Manager};

const LEGACY_ORIGIN: &str = "http://127.0.0.1:21416";
const BRIDGE_LABEL: &str = "settings-migration";
const MAX_MESSAGE_BYTES: usize = 4 * 1024 * 1024;

pub fn legacy_storage_exists(directory: &Path) -> Result<bool, String> {
    for parent in [
        "webview/EBWebView/Default/IndexedDB",
        "webview/Default/IndexedDB",
    ] {
        for suffix in ["leveldb", "blob"] {
            let path = directory
                .join(parent)
                .join(format!("http_127.0.0.1_21416.indexeddb.{suffix}"));
            match fs::symlink_metadata(path) {
                Ok(metadata) if metadata.is_dir() => return Ok(true),
                Ok(_) => {
                    return Err("The original settings storage has an unexpected format.".into())
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(_) => {
                    return Err("The original settings storage could not be inspected.".into())
                }
            }
        }
    }
    Ok(false)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct MigrationMessage {
    schema_version: u32,
    nonce: String,
    status: String,
    settings: Option<Value>,
}

fn parse_message(
    source: &str,
    expected_url: &str,
    raw: &str,
    nonce: &str,
) -> Result<Option<Value>, String> {
    if source != expected_url || raw.len() > MAX_MESSAGE_BYTES {
        return Err("The settings migration response could not be verified.".into());
    }
    let message: MigrationMessage =
        serde_json::from_str(raw).map_err(|_| "The settings migration response is invalid.")?;
    if message.schema_version != 1 || message.nonce != nonce {
        return Err("The settings migration response could not be verified.".into());
    }
    match message.status.as_str() {
        "found" if message.settings.is_some() => Ok(message.settings),
        "empty" if message.settings.is_none() => Ok(None),
        _ => Err("Original settings could not be read. Original data is preserved. Retry the connection page.".into()),
    }
}

pub fn close_bridge(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(BRIDGE_LABEL) {
        let _ = window.destroy();
    }
}

#[cfg(not(windows))]
pub async fn read_legacy_settings(
    _app: &AppHandle,
    _directory: &Path,
) -> Result<Option<Value>, String> {
    Err("Original Windows settings require migration in the Windows client.".into())
}

#[cfg(windows)]
pub async fn read_legacy_settings(
    app: &AppHandle,
    directory: &Path,
) -> Result<Option<Value>, String> {
    use std::{
        sync::{Arc, Mutex},
        time::Duration,
    };
    use tauri::{
        webview::{NewWindowResponse, PermissionResponse},
        WebviewUrl, WebviewWindowBuilder,
    };
    use tokio::sync::oneshot;
    use windows::core::GUID;

    let nonce = format!(
        "{:?}",
        GUID::new().map_err(|_| "Settings migration could not be initialized.")?
    );
    let nonce = nonce.replace(['{', '}', '-'], "");
    let expected_url = format!("{LEGACY_ORIGIN}/__settings_migration/{nonce}");
    let allowed_url = expected_url.clone();
    let window = WebviewWindowBuilder::new(
        app,
        BRIDGE_LABEL,
        WebviewUrl::External("about:blank".parse().unwrap()),
    )
    .visible(false)
    .focused(false)
    .skip_taskbar(true)
    .data_directory(directory.join("webview"))
    .on_navigation(move |url| url.as_str() == "about:blank" || url.as_str() == allowed_url)
    .on_new_window(|_, _| NewWindowResponse::Deny)
    .on_permission_request(|_, _| PermissionResponse::Deny)
    .on_download(|_, _| false)
    .build()
    .map_err(|_| "The settings migration window could not be created.")?;
    let (sender, receiver) = oneshot::channel();
    let completion = Arc::new(Mutex::new(Some(sender)));
    let setup_completion = completion.clone();
    window.with_webview(move |platform| {
        let result = unsafe { install_bridge(platform, &expected_url, &nonce, setup_completion.clone()) };
        if result.is_err() {
            finish(&setup_completion, Err("The settings migration network guard could not be installed. Original data is preserved.".into()));
        }
    }).map_err(|_| "The settings migration window is unavailable.")?;
    match tokio::time::timeout(Duration::from_secs(10), receiver).await {
        Ok(Ok(result)) => result,
        _ => Err(
            "Settings migration timed out. Original data is preserved. Retry the connection page."
                .into(),
        ),
    }
}

#[cfg(windows)]
type MigrationResult = Result<Option<Value>, String>;

#[cfg(windows)]
type Completion =
    std::sync::Arc<std::sync::Mutex<Option<tokio::sync::oneshot::Sender<MigrationResult>>>>;

#[cfg(windows)]
fn finish(completion: &Completion, result: Result<Option<Value>, String>) {
    if let Ok(mut sender) = completion.lock() {
        if let Some(sender) = sender.take() {
            let _ = sender.send(result);
        }
    }
}

#[cfg(windows)]
unsafe fn install_bridge(
    platform: tauri::webview::PlatformWebview,
    expected_url: &str,
    nonce: &str,
    completion: Completion,
) -> windows::core::Result<()> {
    use webview2_com::{
        take_pwstr, Microsoft::Web::WebView2::Win32::*, WebMessageReceivedEventHandler,
        WebResourceRequestedEventHandler,
    };
    use windows::{
        core::{w, Interface, HSTRING, PWSTR},
        Win32::UI::Shell::SHCreateMemStream,
    };

    let webview = platform.controller().CoreWebView2()?;
    let environment = platform.environment();
    let settings = webview.Settings()?;
    settings.SetAreHostObjectsAllowed(false)?;
    settings.SetAreDefaultScriptDialogsEnabled(false)?;
    settings.SetAreDevToolsEnabled(false)?;
    let html = migration_html(nonce);
    let stream =
        SHCreateMemStream(Some(html.as_bytes())).ok_or_else(windows::core::Error::from_thread)?;
    let headers = HSTRING::from("Content-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nContent-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; connect-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'\r\n");
    let document = environment.CreateWebResourceResponse(&stream, 200, w!("OK"), &headers)?;
    let denied = environment.CreateWebResourceResponse(
        None,
        403,
        w!("Forbidden"),
        w!("Content-Length: 0\r\nCache-Control: no-store\r\n"),
    )?;
    let url = expected_url.to_owned();
    let guard_completion = completion.clone();
    let guard_webview = webview.clone();
    let mut token = 0;
    webview.add_WebResourceRequested(
        &WebResourceRequestedEventHandler::create(Box::new(move |_, args| {
            let guarded = || -> windows::core::Result<()> {
                let args = args.ok_or_else(windows::core::Error::from_thread)?;
                let request = args.Request()?;
                let mut uri = PWSTR::null();
                request.Uri(&mut uri)?;
                let uri = take_pwstr(uri);
                args.SetResponse(if uri == url { &document } else { &denied })
            };
            if guarded().is_err() {
                let _ = guard_webview.Stop();
                finish(
                    &guard_completion,
                    Err(
                        "The settings migration network guard failed. Original data is preserved."
                            .into(),
                    ),
                );
            }
            Ok(())
        })),
        &mut token,
    )?;
    // Unlike the older filter, this also covers service/shared workers. Attach
    // every guard before the first HTTP navigation is even scheduled.
    webview
        .cast::<ICoreWebView2_22>()?
        .AddWebResourceRequestedFilterWithRequestSourceKinds(
            w!("*"),
            COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
            COREWEBVIEW2_WEB_RESOURCE_REQUEST_SOURCE_KINDS_ALL,
        )?;
    let source_url = expected_url.to_owned();
    let message_nonce = nonce.to_owned();
    let message_completion = completion.clone();
    webview.add_WebMessageReceived(
        &WebMessageReceivedEventHandler::create(Box::new(move |_, args| {
            let read = || -> windows::core::Result<Option<Result<Option<Value>, String>>> {
                let args = args.ok_or_else(windows::core::Error::from_thread)?;
                let mut source = PWSTR::null();
                args.Source(&mut source)?;
                let source = take_pwstr(source);
                // Ignore Tauri bootstrap messages from the initial blank document.
                if source != source_url {
                    return Ok(None);
                }
                let mut raw = PWSTR::null();
                if args.TryGetWebMessageAsString(&mut raw).is_err() {
                    return Ok(None);
                }
                let raw = take_pwstr(raw);
                if !raw.starts_with("vcc-settings-migration:") {
                    return Ok(None);
                }
                Ok(Some(parse_message(
                    &source,
                    &source_url,
                    &raw["vcc-settings-migration:".len()..],
                    &message_nonce,
                )))
            };
            match read() {
                Ok(Some(result)) => finish(&message_completion, result),
                Ok(None) => {}
                Err(_) => finish(
                    &message_completion,
                    Err("The settings migration response could not be read.".into()),
                ),
            }
            Ok(())
        })),
        &mut token,
    )?;
    prepare_navigation(webview, expected_url.to_owned(), completion)
}

#[cfg(windows)]
unsafe fn prepare_navigation(
    webview: webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2,
    expected_url: String,
    completion: Completion,
) -> windows::core::Result<()> {
    use webview2_com::CallDevToolsProtocolMethodCompletedHandler;
    use windows::core::{w, HSTRING};
    let next_webview = webview.clone();
    webview.CallDevToolsProtocolMethod(
        w!("Network.setBypassServiceWorker"),
        w!("{\"bypass\":true}"),
        &CallDevToolsProtocolMethodCompletedHandler::create(Box::new(move |result, _| {
            if result.is_err() {
                finish(
                    &completion,
                    Err("Settings migration could not bypass the original service worker.".into()),
                );
                return Ok(());
            }
            let navigate_webview = next_webview.clone();
            let callback_completion = completion.clone();
            let result = next_webview.CallDevToolsProtocolMethod(
                w!("Network.setCacheDisabled"),
                w!("{\"cacheDisabled\":true}"),
                &CallDevToolsProtocolMethodCompletedHandler::create(Box::new(move |result, _| {
                    if result.is_err()
                        || navigate_webview
                            .Navigate(&HSTRING::from(expected_url))
                            .is_err()
                    {
                        finish(
                            &callback_completion,
                            Err(
                                "Settings migration could not open the trusted recovery document."
                                    .into(),
                            ),
                        );
                    }
                    Ok(())
                })),
            );
            if result.is_err() {
                finish(
                    &completion,
                    Err("Settings migration could not disable the original cached page.".into()),
                );
            }
            Ok(())
        })),
    )
}

fn migration_html(nonce: &str) -> String {
    let nonce = serde_json::to_string(nonce).unwrap();
    format!(
        r#"<!doctype html><html><head><meta charset="utf-8"></head><body><script>
"use strict";
(async () => {{
  const nonce = {nonce};
  const send = (status, settings = null) => chrome.webview.postMessage("vcc-settings-migration:" + JSON.stringify({{schema_version: 1, nonce, status, settings}}));
  try {{
    const databases = await indexedDB.databases();
    if (!databases.some(database => database.name === "vcclient-settings")) {{ send("empty"); return; }}
    const database = await new Promise((resolve, reject) => {{
      const request = indexedDB.open("vcclient-settings");
      request.onupgradeneeded = () => {{ request.transaction.abort(); reject(new Error("Database disappeared")); }};
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Database is in use"));
      request.onsuccess = () => resolve(request.result);
    }});
    try {{
      if (!database.objectStoreNames.contains("global-settings")) {{ send("empty"); return; }}
      const settings = await new Promise((resolve, reject) => {{
        const transaction = database.transaction("global-settings", "readonly");
        const request = transaction.objectStore("global-settings").get("settings");
        transaction.oncomplete = () => resolve(request.result);
        transaction.onabort = () => reject(transaction.error);
        transaction.onerror = () => reject(transaction.error);
      }});
      send(settings == null ? "empty" : "found", settings ?? null);
    }} finally {{ database.close(); }}
  }} catch (_) {{ send("error"); }}
}})();
</script></body></html>"#
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migration_messages_require_the_exact_document_nonce_schema_and_valid_payload() {
        let url = format!("{LEGACY_ORIGIN}/__settings_migration/nonce");
        let raw =
            r#"{"schema_version":1,"nonce":"nonce","status":"found","settings":{"volume":0}}"#;
        assert_eq!(
            parse_message(&url, &url, raw, "nonce").unwrap(),
            Some(serde_json::json!({"volume":0}))
        );
        assert!(parse_message("http://127.0.0.1:21416/", &url, raw, "nonce").is_err());
        assert!(parse_message(&url, &url, raw, "wrong").is_err());
        assert!(parse_message(
            &url,
            &url,
            &raw.replace("schema_version\":1", "schema_version\":2"),
            "nonce"
        )
        .is_err());
        assert!(parse_message(&url, &url, &"x".repeat(MAX_MESSAGE_BYTES + 1), "nonce").is_err());
        assert!(parse_message(
            &url,
            &url,
            r#"{"schema_version":1,"nonce":"nonce","status":"found","settings":null}"#,
            "nonce"
        )
        .is_err());
    }

    #[test]
    fn bridge_reads_only_the_existing_database_and_contains_no_network_resources() {
        let html = migration_html("test");
        assert!(html.contains("\"readonly\""));
        assert!(html.contains("request.transaction.abort()"));
        assert!(!html.contains(".put("));
        assert!(!html.contains("deleteDatabase"));
        assert!(!html.contains("fetch("));
        assert!(!html.contains("src="));
    }
}
