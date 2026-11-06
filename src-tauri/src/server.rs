//! A loopback-only origin for embedded assets and the existing 2.x backend protocol.
//! No model files, inference process, or microphone are owned by this server.
use axum::{
    body::Body,
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        FromRequestParts, Request, State,
    },
    http::{header, HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
    Router,
};
use futures_util::{SinkExt, StreamExt};
use include_dir::{include_dir, Dir};
use std::{error::Error, net::IpAddr, sync::Arc, time::Duration};
use tokio::{
    net::{TcpListener, TcpStream},
    sync::watch,
    task::JoinHandle,
};
use tokio_tungstenite::tungstenite::{client::IntoClientRequest, Message as UpstreamMessage};

static ASSETS: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../dist");
type ServerError = Box<dyn Error + Send + Sync>;

#[derive(Clone)]
struct ServerState {
    origin: String,
    authority: String,
    backend: watch::Sender<BackendTarget>,
    stop: watch::Receiver<bool>,
}

#[derive(Clone)]
struct BackendTarget {
    url: Option<reqwest::Url>,
    client: reqwest::Client,
    generation: u64,
}

#[derive(Debug, serde::Serialize)]
pub struct BackendConnection {
    pub address: String,
    pub generation: u64,
}

pub struct RunningServer {
    pub origin: String,
    backend: watch::Sender<BackendTarget>,
    stop: watch::Sender<bool>,
    task: Option<JoinHandle<()>>,
}

impl RunningServer {
    #[cfg(test)]
    pub fn configure(&self, address: &str) -> Result<BackendConnection, String> {
        self.configure_with(address, |_| Ok(()))
    }

    pub fn configure_with(
        &self,
        address: &str,
        persist: impl FnOnce(&str) -> Result<(), String>,
    ) -> Result<BackendConnection, String> {
        let url = parse_backend(address).map_err(|error| error.to_string())?;
        let port = reqwest::Url::parse(&self.origin)
            .unwrap()
            .port_or_known_default()
            .unwrap();
        reject_self_target(&url, port).map_err(|error| error.to_string())?;
        let client = backend_client(port, Some(&url)).map_err(|error| error.to_string())?;
        persist(url.as_str())?;
        let mut generation = 0;
        self.backend.send_modify(|target| {
            generation = target.generation + 1;
            *target = BackendTarget {
                url: Some(url.clone()),
                client,
                generation,
            };
        });
        Ok(BackendConnection {
            address: url.to_string(),
            generation,
        })
    }

    /// Cancel requests, upgraded sockets, and the listener without blocking the UI thread.
    pub fn shutdown(&self) {
        self.stop.send_replace(true);
    }

    pub async fn wait(mut self) {
        self.shutdown();
        if let Some(mut task) = self.task.take() {
            if tokio::time::timeout(Duration::from_secs(2), &mut task)
                .await
                .is_err()
            {
                task.abort();
                let _ = task.await;
            }
        }
    }
}

impl Drop for RunningServer {
    fn drop(&mut self) {
        self.shutdown();
    }
}

pub fn parse_backend(value: &str) -> Result<reqwest::Url, ServerError> {
    if value.len() > 8192 || value.chars().any(char::is_control) || value.contains('\\') {
        return Err("Backend address contains unsupported characters".into());
    }
    let mut url = reqwest::Url::parse(value.trim())?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.port_or_known_default() == Some(0)
        || decoded_path(url.path()).is_err()
    {
        return Err(
            "Backend must be an HTTP or HTTPS address without credentials, query or fragment"
                .into(),
        );
    }
    let path = format!("{}/", url.path().trim_end_matches('/'));
    url.set_path(&path);
    Ok(url)
}

fn local_address(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(ip) => ip.is_loopback() || ip.is_unspecified(),
        IpAddr::V6(ip) => {
            ip.is_loopback()
                || ip.is_unspecified()
                || ip
                    .to_ipv4_mapped()
                    .is_some_and(|ip| ip.is_loopback() || ip.is_unspecified())
        }
    }
}

fn reject_self_target(url: &reqwest::Url, local_port: u16) -> Result<(), ServerError> {
    let local_host = match url.host() {
        Some(url::Host::Ipv4(ip)) => local_address(IpAddr::V4(ip)),
        Some(url::Host::Ipv6(ip)) => local_address(IpAddr::V6(ip)),
        Some(url::Host::Domain(host)) => {
            host.trim_end_matches('.').eq_ignore_ascii_case("localhost")
        }
        None => false,
    };
    if local_host && url.port_or_known_default() == Some(local_port) {
        return Err("Backend cannot point to the client page server".into());
    }
    Ok(())
}

struct BackendResolver {
    local_port: u16,
    backend_port: u16,
}

impl reqwest::dns::Resolve for BackendResolver {
    fn resolve(&self, name: reqwest::dns::Name) -> reqwest::dns::Resolving {
        let reject_local = self.local_port == self.backend_port;
        Box::pin(async move {
            let addresses: Vec<_> = tokio::net::lookup_host((name.as_str(), 0)).await?.collect();
            if reject_local && addresses.iter().any(|address| local_address(address.ip())) {
                return Err(
                    std::io::Error::other("Backend resolves to the client page server").into(),
                );
            }
            Ok(Box::new(addresses.into_iter()) as reqwest::dns::Addrs)
        })
    }
}

fn backend_client(
    local_port: u16,
    backend: Option<&reqwest::Url>,
) -> Result<reqwest::Client, ServerError> {
    Ok(reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .dns_resolver(Arc::new(BackendResolver {
            local_port,
            backend_port: backend
                .and_then(reqwest::Url::port_or_known_default)
                .unwrap_or(0),
        }))
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(300))
        .build()?)
}

pub async fn start(port: u16, backend: Option<String>) -> Result<RunningServer, ServerError> {
    let backend = backend.as_deref().map(parse_backend).transpose()?;
    let listener = match TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, port)).await {
        Ok(listener) => listener,
        Err(error) if error.kind() == std::io::ErrorKind::AddrInUse => {
            TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0)).await?
        }
        Err(error) => return Err(error.into()),
    };
    let authority = listener.local_addr()?.to_string();
    let origin = format!("http://{authority}");
    let local_port = listener.local_addr()?.port();
    if let Some(backend) = &backend {
        reject_self_target(backend, local_port)?;
    }
    let client = backend_client(local_port, backend.as_ref())?;
    let (backend, _) = watch::channel(BackendTarget {
        url: backend,
        client,
        generation: 0,
    });
    let (stop, receiver) = watch::channel(false);
    let state = Arc::new(ServerState {
        origin: origin.clone(),
        authority,
        backend: backend.clone(),
        stop: receiver.clone(),
    });
    let app = Router::new().fallback(handle).with_state(state);
    let task = tokio::spawn(async move {
        let _ = axum::serve(listener, app)
            .with_graceful_shutdown(cancelled(receiver))
            .await;
    });
    Ok(RunningServer {
        origin,
        backend,
        stop,
        task: Some(task),
    })
}

async fn cancelled(mut stop: watch::Receiver<bool>) {
    while !*stop.borrow_and_update() {
        if stop.changed().await.is_err() {
            break;
        }
    }
}

async fn backend_changed(mut backend: watch::Receiver<BackendTarget>, generation: u64) {
    while backend.borrow_and_update().generation == generation {
        if backend.changed().await.is_err() {
            break;
        }
    }
}

fn error(status: StatusCode, message: &'static str) -> Response {
    (
        status,
        [(header::CONTENT_TYPE, "application/json")],
        format!("{{\"error\":\"{message}\"}}"),
    )
        .into_response()
}

fn allowed(headers: &HeaderMap, state: &ServerState) -> bool {
    let exact = |name: &str, expected: &str, required: bool| {
        let values: Vec<_> = headers.get_all(name).iter().collect();
        if values.is_empty() {
            return !required;
        }
        values.len() == 1 && values[0].to_str().ok() == Some(expected)
    };
    exact("host", &state.authority, true)
        && exact("origin", &state.origin, false)
        && !headers
            .get_all("sec-fetch-site")
            .iter()
            .any(|value| value == "cross-site")
}

fn decoded_path(raw: &str) -> Result<String, ()> {
    // Reject malformed escapes and ambiguous path forms before URL normalization.
    let bytes = raw.as_bytes();
    for (index, byte) in bytes.iter().enumerate() {
        if *byte == b'%'
            && (index + 2 >= bytes.len()
                || !bytes[index + 1].is_ascii_hexdigit()
                || !bytes[index + 2].is_ascii_hexdigit())
        {
            return Err(());
        }
    }
    let path = percent_encoding::percent_decode_str(raw)
        .decode_utf8()
        .map_err(|_| ())?
        .into_owned();
    if !path.starts_with('/')
        || path.starts_with("//")
        || path.chars().any(char::is_control)
        || path.contains('\\')
        || path.split('/').any(|part| part == "." || part == "..")
    {
        return Err(());
    }
    Ok(path)
}

fn proxy_path(path: &str) -> bool {
    [
        "/api/",
        "/api_",
        "/socket.io/",
        "/model_dir/",
        "/upload_dir/",
        "/tmp_dir/",
    ]
    .iter()
    .any(|prefix| path.starts_with(prefix))
        || [
            "/vcclient.log",
            "/info",
            "/performance",
            "/upload_file",
            "/concat_uploaded_file",
            "/update_settings",
            "/load_model",
            "/load_model_if_empty",
            "/reset_audio",
            "/onnx",
            "/export2onnx",
            "/merge_model",
            "/update_model_default",
            "/update_model_info",
            "/upload_model_assets",
            "/test",
        ]
        .contains(&path)
}

async fn handle(State(state): State<Arc<ServerState>>, request: Request) -> Response {
    if !allowed(request.headers(), &state) {
        return error(
            StatusCode::FORBIDDEN,
            "Cross-origin requests are not allowed",
        );
    }
    let path = match decoded_path(request.uri().path()) {
        Ok(path) => path,
        Err(_) => return error(StatusCode::BAD_REQUEST, "Invalid path"),
    };
    tokio::select! {
        biased;
        _ = cancelled(state.stop.clone()) => error(StatusCode::SERVICE_UNAVAILABLE, "Client is closing"),
        response = dispatch(state.clone(), request, path) => response,
    }
}

async fn dispatch(state: Arc<ServerState>, request: Request, path: String) -> Response {
    if proxy_path(&path) {
        let mut changes = state.backend.subscribe();
        let target = changes.borrow_and_update().clone();
        let Some(backend) = &target.url else {
            return error(StatusCode::SERVICE_UNAVAILABLE, "No backend configured");
        };
        let path_query = request
            .uri()
            .path_and_query()
            .map_or("/", |value| value.as_str());
        let Ok(url) = backend.join(path_query.trim_start_matches('/')) else {
            return error(StatusCode::BAD_REQUEST, "Invalid backend path");
        };
        if request
            .headers()
            .get(header::UPGRADE)
            .is_some_and(|value| value.as_bytes().eq_ignore_ascii_case(b"websocket"))
        {
            if !path.starts_with("/socket.io/") && !path.starts_with("/api/") {
                return error(StatusCode::BAD_REQUEST, "Unsupported WebSocket path");
            }
            return tokio::select! {
                biased;
                _ = backend_changed(changes.clone(), target.generation) => error(StatusCode::SERVICE_UNAVAILABLE, "Backend changed"),
                response = proxy_websocket(state, request, url, target, changes) => response,
            };
        }
        return tokio::select! {
            biased;
            _ = backend_changed(changes.clone(), target.generation) => error(StatusCode::SERVICE_UNAVAILABLE, "Backend changed"),
            response = proxy_http(state, request, url, target, changes) => response,
        };
    }
    if request.method() != Method::GET && request.method() != Method::HEAD {
        return error(StatusCode::METHOD_NOT_ALLOWED, "Static files are read-only");
    }
    let name = if path == "/" {
        "index.html"
    } else {
        path.trim_start_matches('/')
    };
    let Some(file) = ASSETS.get_file(name) else {
        return error(StatusCode::NOT_FOUND, "File not found");
    };
    let mime = mime_guess::from_path(name)
        .first_or_octet_stream()
        .to_string();
    let body = if request.method() == Method::HEAD {
        Body::empty()
    } else {
        Body::from(file.contents())
    };
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime)
        .header(header::CONTENT_LENGTH, file.contents().len())
        .header(header::CACHE_CONTROL, "no-store")
        .header("x-content-type-options", "nosniff")
        .header(
            "content-security-policy",
            "frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        )
        .body(body)
        .expect("Static response headers are valid")
}

fn end_to_end_headers(headers: &HeaderMap) -> HeaderMap {
    let nominated: Vec<_> = headers
        .get_all(header::CONNECTION)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(','))
        .map(|name| name.trim().to_ascii_lowercase())
        .collect();
    let mut clean = headers.clone();
    for name in [
        "host",
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailer",
        "transfer-encoding",
        "upgrade",
    ] {
        clean.remove(name);
    }
    for name in nominated {
        clean.remove(name);
    }
    clean
}

fn backend_headers(headers: &HeaderMap, target: &reqwest::Url) -> HeaderMap {
    let mut headers = end_to_end_headers(headers);
    // The local Host/Origin guard has already authenticated the browser side.
    // The selected service sees its own origin, including its actual port.
    if headers.contains_key(header::ORIGIN) {
        headers.insert(
            header::ORIGIN,
            target.origin().ascii_serialization().parse().unwrap(),
        );
    }
    headers
}

async fn proxy_http(
    state: Arc<ServerState>,
    request: Request,
    url: reqwest::Url,
    target: BackendTarget,
    changes: watch::Receiver<BackendTarget>,
) -> Response {
    let (parts, body) = request.into_parts();
    let upstream = target
        .client
        .request(parts.method, url.clone())
        .headers(backend_headers(&parts.headers, &url))
        .body(reqwest::Body::wrap_stream(body.into_data_stream()))
        .send()
        .await;
    let upstream = match upstream {
        Ok(response) => response,
        Err(error) => {
            let category = if error.is_timeout() {
                "timeout"
            } else if error.is_connect() {
                "connect"
            } else if error.is_body() {
                "body"
            } else if error.is_request() {
                "request"
            } else {
                "other"
            };
            return (
                StatusCode::BAD_GATEWAY,
                [(header::CONTENT_TYPE, "application/json")],
                format!(r#"{{"error":{{"code":"backend_transport","reason":"Backend request failed ({category})"}}}}"#),
            )
                .into_response();
        }
    };
    let status = upstream.status();
    let headers = end_to_end_headers(upstream.headers());
    let stream = upstream.bytes_stream();
    // Dropping the response or closing the application cancels an unfinished upload/download.
    let stream = futures_util::stream::unfold(
        (
            Box::pin(stream),
            state.stop.clone(),
            changes,
            target.generation,
        ),
        |(mut stream, stop, changes, generation)| async move {
            tokio::select! {
                biased;
                _ = cancelled(stop.clone()) => None,
                _ = backend_changed(changes.clone(), generation) => None,
                next = stream.next() => next.map(|chunk| (chunk, (stream, stop, changes, generation))),
            }
        },
    );
    let mut response = Response::new(Body::from_stream(stream));
    *response.status_mut() = status;
    *response.headers_mut() = headers;
    response
}

async fn proxy_websocket(
    state: Arc<ServerState>,
    request: Request,
    mut url: reqwest::Url,
    target: BackendTarget,
    changes: watch::Receiver<BackendTarget>,
) -> Response {
    let (mut parts, _) = request.into_parts();
    let Ok(mut upgrade) = WebSocketUpgrade::from_request_parts(&mut parts, &()).await else {
        return error(StatusCode::BAD_REQUEST, "Invalid WebSocket handshake");
    };
    let headers = backend_headers(&parts.headers, &url);
    let scheme = if url.scheme() == "https" { "wss" } else { "ws" };
    url.set_scheme(scheme).unwrap();
    let Ok(mut upstream_request) = url.as_str().into_client_request() else {
        return error(StatusCode::BAD_GATEWAY, "Invalid backend WebSocket URL");
    };
    // Preserve application authentication and subprotocols, but generate a fresh handshake.
    for (name, value) in headers.iter() {
        if !matches!(
            name.as_str(),
            "sec-websocket-key"
                | "sec-websocket-version"
                | "sec-websocket-extensions"
                | "content-length"
        ) {
            upstream_request.headers_mut().append(name, value.clone());
        }
    }
    let connect = async {
        let hostname = match url.host().unwrap() {
            url::Host::Domain(host) => host.to_owned(),
            url::Host::Ipv4(ip) => ip.to_string(),
            url::Host::Ipv6(ip) => ip.to_string(),
        };
        let port = url.port_or_known_default().unwrap();
        let addresses: Vec<_> = tokio::net::lookup_host((hostname.as_str(), port))
            .await?
            .collect();
        let local_port = reqwest::Url::parse(&state.origin).unwrap().port().unwrap();
        if port == local_port && addresses.iter().any(|address| local_address(address.ip())) {
            return Err("Backend resolves to the client page server".into());
        }
        // Connect only to the addresses just checked, preventing a second DNS
        // lookup from redirecting a WebSocket back to this page server.
        let stream = TcpStream::connect(addresses.as_slice()).await?;
        let roots =
            rustls::RootCertStore::from_iter(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
        let config = rustls::ClientConfig::builder()
            .with_root_certificates(roots)
            .with_no_client_auth();
        let connector = tokio_tungstenite::Connector::Rustls(Arc::new(config));
        tokio_tungstenite::client_async_tls_with_config(
            upstream_request,
            stream,
            None,
            Some(connector),
        )
        .await
        .map_err(|error| -> ServerError { error.into() })
    };
    let connected = tokio::time::timeout(Duration::from_secs(10), connect).await;
    let Ok(Ok((upstream, reply))) = connected else {
        return error(
            StatusCode::BAD_GATEWAY,
            "Backend WebSocket connection failed",
        );
    };
    if let Some(protocol) = reply.headers().get("sec-websocket-protocol") {
        upgrade.set_selected_protocol(protocol.clone());
    }
    upgrade.on_upgrade(move |socket| {
        bridge_websocket(
            socket,
            upstream,
            state.stop.clone(),
            changes,
            target.generation,
        )
    })
}

async fn bridge_websocket(
    socket: WebSocket,
    upstream: tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    stop: watch::Receiver<bool>,
    changes: watch::Receiver<BackendTarget>,
    generation: u64,
) {
    let (mut browser_writer, mut browser_reader) = socket.split();
    let (mut backend_writer, mut backend_reader) = upstream.split();
    let to_backend = async {
        while let Some(Ok(message)) = browser_reader.next().await {
            let message = match message {
                Message::Text(value) => UpstreamMessage::Text(value.to_string().into()),
                Message::Binary(value) => UpstreamMessage::Binary(value),
                Message::Ping(value) => UpstreamMessage::Ping(value),
                Message::Pong(value) => UpstreamMessage::Pong(value),
                Message::Close(_) => {
                    let _ = backend_writer.close().await;
                    break;
                }
            };
            if backend_writer.send(message).await.is_err() {
                break;
            }
        }
    };
    let to_browser = async {
        while let Some(Ok(message)) = backend_reader.next().await {
            let message = match message {
                UpstreamMessage::Text(value) => Message::Text(value.to_string().into()),
                UpstreamMessage::Binary(value) => Message::Binary(value),
                UpstreamMessage::Ping(value) => Message::Ping(value),
                UpstreamMessage::Pong(value) => Message::Pong(value),
                UpstreamMessage::Close(_) => {
                    let _ = browser_writer.close().await;
                    break;
                }
                UpstreamMessage::Frame(_) => continue,
            };
            if browser_writer.send(message).await.is_err() {
                break;
            }
        }
    };
    tokio::select! {
        biased;
        _ = cancelled(stop) => {},
        _ = backend_changed(changes, generation) => {},
        _ = to_backend => {},
        _ = to_browser => {},
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restrict_backend_and_paths() {
        for value in [
            "file:///C:/model",
            "javascript:alert(1)",
            "ftp://server.local/",
            "http://127.0.0.1:0/",
            "http://user@127.0.0.1:18000/",
            "https://user:password@server.local/",
            "http://127.0.0.1:18000/?x=1",
            "http://127.0.0.1:18000/#x",
            "http://server.local/a\\b",
            "http://server.local/a\nb",
            "http://server.local/%00",
        ] {
            assert!(parse_backend(value).is_err(), "{value}");
        }
        for (value, normalized) in [
            ("http://localhost:18888", "http://localhost:18888/"),
            ("https://server.local/vcc", "https://server.local/vcc/"),
            (
                "http://192.168.1.10:18888/base/",
                "http://192.168.1.10:18888/base/",
            ),
            ("http://[::1]:18888/", "http://[::1]:18888/"),
            (
                "https://SERVER.local:443/base/./",
                "https://server.local/base/",
            ),
        ] {
            assert_eq!(parse_backend(value).unwrap().as_str(), normalized);
        }
        for path in [
            "//evil",
            "/%2e%2e/index.html",
            "/src/../index.html",
            "/a%00",
            "/%ff",
            "/%xz",
            "/a%5cb",
        ] {
            assert!(decoded_path(path).is_err(), "{path}");
        }
        assert!(!proxy_path("/api-malicious"));
        assert!(proxy_path("/api_info"));
        assert!(proxy_path("/info"));
        assert!(proxy_path("/update_settings"));
        assert!(proxy_path("/load_model_if_empty"));
        assert!(proxy_path("/reset_audio"));
        assert!(!proxy_path("/reset_audio/other"));
        assert!(!proxy_path("/load_model_if_empty/other"));
        assert!(!proxy_path("/info/malicious"));
    }

    #[tokio::test]
    async fn occupied_page_port_falls_back_and_self_targets_are_rejected() {
        let occupied = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .await
            .unwrap();
        let port = occupied.local_addr().unwrap().port();
        let server = start(port, None).await.unwrap();
        let actual = reqwest::Url::parse(&server.origin).unwrap().port().unwrap();
        assert_ne!(port, actual);
        for host in [
            "127.0.0.1",
            "localhost",
            "[::1]",
            "127.1",
            "[::ffff:127.0.0.1]",
        ] {
            assert!(server
                .configure(&format!("http://{host}:{actual}/"))
                .is_err());
        }
        assert!(server
            .configure(&format!("http://localhost:{port}/"))
            .is_ok());
        server.wait().await;
    }

    #[tokio::test]
    async fn base_path_and_backend_origin_are_preserved_after_the_local_guard() {
        async fn echo(request: Request) -> Response {
            let expected_origin = format!(
                "http://{}",
                request.headers()[header::HOST].to_str().unwrap()
            );
            assert_eq!(request.uri().path(), "/vcc/info");
            assert_eq!(request.uri().query(), Some("raw=%2F"));
            assert_eq!(request.headers()[header::ORIGIN], expected_origin);
            assert_eq!(request.headers()[header::AUTHORIZATION], "Bearer fixture");
            "identified".into_response()
        }
        let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .await
            .unwrap();
        let address = format!("http://{}/vcc", listener.local_addr().unwrap());
        let backend_task = tokio::spawn(async {
            axum::serve(listener, Router::new().fallback(echo))
                .await
                .unwrap()
        });
        let server = start(0, None).await.unwrap();
        let result = server.configure(&address).unwrap();
        assert_eq!(result.generation, 1);
        assert!(result.address.ends_with("/vcc/"));
        let client = reqwest::Client::builder().no_proxy().build().unwrap();
        let response = client
            .get(format!("{}/info?raw=%2F", server.origin))
            .header(header::ORIGIN, &server.origin)
            .header(header::AUTHORIZATION, "Bearer fixture")
            .send()
            .await
            .unwrap();
        assert_eq!(response.text().await.unwrap(), "identified");
        server.wait().await;
        backend_task.abort();
    }

    #[tokio::test]
    async fn serves_embedded_files_and_enforces_origin() {
        let server = start(0, None).await.unwrap();
        let client = reqwest::Client::builder().no_proxy().build().unwrap();
        let response = client.get(&server.origin).send().await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert!(response.headers()[header::CONTENT_TYPE]
            .to_str()
            .unwrap()
            .contains("text/html"));
        let html = response.text().await.unwrap();
        assert!(html.contains("<html"));
        let head = client.head(&server.origin).send().await.unwrap();
        assert_eq!(
            head.headers()[header::CONTENT_LENGTH].to_str().unwrap(),
            html.len().to_string()
        );
        assert!(head.bytes().await.unwrap().is_empty());
        for (path, status) in [
            ("/missing", 404),
            ("/reference/v2.1.4-alpha/app.js", 404),
            ("/api/info", 503),
            ("/api_info", 503),
        ] {
            assert_eq!(
                client
                    .get(format!("{}{path}", server.origin))
                    .send()
                    .await
                    .unwrap()
                    .status()
                    .as_u16(),
                status
            );
        }
        assert_eq!(
            client.post(&server.origin).send().await.unwrap().status(),
            StatusCode::METHOD_NOT_ALLOWED
        );
        for (name, value) in [
            ("host", "evil.test"),
            ("origin", "https://evil.test"),
            ("sec-fetch-site", "cross-site"),
        ] {
            assert_eq!(
                client
                    .get(&server.origin)
                    .header(name, value)
                    .send()
                    .await
                    .unwrap()
                    .status(),
                StatusCode::FORBIDDEN
            );
        }
        let origin = server.origin.clone();
        server.wait().await;
        assert!(client.get(origin).send().await.is_err());
    }

    #[tokio::test]
    async fn forwards_raw_upload_query_status_and_does_not_follow_redirects() {
        async fn echo(request: Request) -> Response {
            let query = request.uri().query().unwrap_or("").to_owned();
            if request.uri().path() == "/api/redirect" {
                return (
                    StatusCode::FOUND,
                    [(header::LOCATION, "http://192.0.2.1/private")],
                )
                    .into_response();
            }
            assert_eq!(
                request.headers()[header::CONTENT_TYPE],
                "multipart/form-data; boundary=boundary"
            );
            let bytes = axum::body::to_bytes(request.into_body(), 1024)
                .await
                .unwrap();
            (StatusCode::CREATED, [("x-query", query)], bytes).into_response()
        }
        let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .await
            .unwrap();
        let backend = format!("http://{}/", listener.local_addr().unwrap());
        let backend_task = tokio::spawn(async {
            axum::serve(listener, Router::new().fallback(echo))
                .await
                .unwrap()
        });
        let server = start(0, Some(backend)).await.unwrap();
        let client = reqwest::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap();
        let payload = b"--boundary\r\nContent-Disposition: form-data; name=\"file\"\r\n\r\n\x00\xff\r\n--boundary--\r\n";
        let response = client
            .post(format!("{}/api/upload?a=%2F&b=hello+world", server.origin))
            .header(
                header::CONTENT_TYPE,
                "multipart/form-data; boundary=boundary",
            )
            .body(payload.to_vec())
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::CREATED);
        assert_eq!(response.headers()["x-query"], "a=%2F&b=hello+world");
        assert_eq!(&response.bytes().await.unwrap()[..], payload);
        let safe_registration = client
            .post(format!("{}/load_model_if_empty", server.origin))
            .header(header::CONTENT_TYPE, "multipart/form-data; boundary=boundary")
            .body(payload.to_vec())
            .send()
            .await
            .unwrap();
        assert_eq!(safe_registration.status(), StatusCode::CREATED);
        assert_eq!(&safe_registration.bytes().await.unwrap()[..], payload);
        let response = client
            .get(format!("{}/api/redirect", server.origin))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::FOUND);
        assert_eq!(
            response.headers()[header::LOCATION],
            "http://192.0.2.1/private"
        );
        backend_task.abort();
        let failed = client.get(format!("{}/api/info", server.origin)).send().await.unwrap();
        assert_eq!(failed.status(), StatusCode::BAD_GATEWAY);
        assert!(failed.text().await.unwrap().contains(r#""code":"backend_transport""#));
        server.wait().await;
    }

    #[tokio::test]
    async fn websocket_roundtrip_and_shutdown() {
        async fn echo(
            upgrade: WebSocketUpgrade,
            uri: axum::extract::OriginalUri,
            headers: HeaderMap,
        ) -> Response {
            assert_eq!(uri.query(), Some("EIO=4&transport=websocket"));
            assert_eq!(
                headers[header::ORIGIN],
                format!("http://{}", headers[header::HOST].to_str().unwrap())
            );
            assert_eq!(headers[header::AUTHORIZATION], "Bearer fixture");
            upgrade
                .protocols(["voice-test"])
                .on_upgrade(|mut socket| async move {
                    while let Some(Ok(message)) = socket.next().await {
                        if socket.send(message).await.is_err() {
                            break;
                        }
                    }
                })
        }
        let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .await
            .unwrap();
        let backend = format!("http://{}/vcc/", listener.local_addr().unwrap());
        let backend_task = tokio::spawn(async {
            axum::serve(
                listener,
                Router::new().route("/vcc/socket.io/", axum::routing::get(echo)),
            )
            .await
            .unwrap()
        });
        let server = start(0, Some(backend)).await.unwrap();
        let url = format!(
            "{}/socket.io/?EIO=4&transport=websocket",
            server.origin.replace("http:", "ws:")
        );
        let mut forbidden = url.clone().into_client_request().unwrap();
        forbidden
            .headers_mut()
            .insert(header::ORIGIN, "https://evil.test".parse().unwrap());
        let error = tokio_tungstenite::connect_async(forbidden)
            .await
            .unwrap_err();
        assert!(
            matches!(error, tokio_tungstenite::tungstenite::Error::Http(reply) if reply.status() == StatusCode::FORBIDDEN)
        );
        let mut request = url.into_client_request().unwrap();
        request
            .headers_mut()
            .insert(header::ORIGIN, server.origin.parse().unwrap());
        request
            .headers_mut()
            .insert(header::AUTHORIZATION, "Bearer fixture".parse().unwrap());
        request
            .headers_mut()
            .insert("sec-websocket-protocol", "voice-test".parse().unwrap());
        let (mut socket, reply) = tokio_tungstenite::connect_async(request).await.unwrap();
        assert_eq!(reply.headers()["sec-websocket-protocol"], "voice-test");
        for message in [
            UpstreamMessage::Text("42[\"test\"]".into()),
            UpstreamMessage::Binary(vec![0, 1, 255].into()),
        ] {
            socket.send(message.clone()).await.unwrap();
            assert_eq!(socket.next().await.unwrap().unwrap(), message);
        }
        // Reconfiguration invalidates upgraded connections as well as REST requests.
        server.configure("http://localhost:18888/").unwrap();
        let closed = tokio::time::timeout(Duration::from_secs(2), socket.next()).await;
        assert!(
            closed.is_ok(),
            "WebSocket remained open after target switch"
        );
        server.wait().await;
        backend_task.abort();
    }

    #[tokio::test]
    async fn https_websocket_uses_tls_and_reports_invalid_tls_as_a_gateway_error() {
        use tokio::io::AsyncReadExt;
        let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .await
            .unwrap();
        let address = format!("https://{}/", listener.local_addr().unwrap());
        let (sent, received) = tokio::sync::oneshot::channel();
        let backend_task = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut first_byte = [0];
            stream.read_exact(&mut first_byte).await.unwrap();
            sent.send(first_byte[0]).unwrap();
            // A non-TLS service must fail, without downgrading the connection.
        });
        let server = start(0, Some(address)).await.unwrap();
        let request = format!(
            "{}/socket.io/?transport=websocket",
            server.origin.replace("http:", "ws:")
        );
        let result = tokio::time::timeout(
            Duration::from_secs(2),
            tokio_tungstenite::connect_async(request),
        )
        .await
        .unwrap();
        assert!(
            matches!(result, Err(tokio_tungstenite::tungstenite::Error::Http(reply)) if reply.status() == StatusCode::BAD_GATEWAY)
        );
        assert_eq!(
            received.await.unwrap(),
            0x16,
            "Expected a TLS handshake record"
        );
        backend_task.await.unwrap();
        server.wait().await;
    }

    #[tokio::test]
    async fn backend_switch_cancels_pending_requests_without_sending_them_to_new_target() {
        let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .await
            .unwrap();
        let backend = format!("http://{}/", listener.local_addr().unwrap());
        let (entered, mut received) = tokio::sync::mpsc::channel::<()>(1);
        let app = Router::new().fallback(move || {
            let entered = entered.clone();
            async move {
                entered.send(()).await.unwrap();
                std::future::pending::<Response>().await
            }
        });
        let backend_task = tokio::spawn(async { axum::serve(listener, app).await.unwrap() });
        let server = start(0, Some(backend)).await.unwrap();
        let url = format!("{}/info", server.origin);
        let request = tokio::spawn(async move {
            reqwest::Client::builder()
                .no_proxy()
                .build()
                .unwrap()
                .get(url)
                .send()
                .await
                .unwrap()
        });
        tokio::time::timeout(Duration::from_secs(2), received.recv())
            .await
            .unwrap();
        let next = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .await
            .unwrap();
        let next_address = format!("http://{}/", next.local_addr().unwrap());
        let next_task = tokio::spawn(async {
            axum::serve(next, Router::new().fallback(|| async { "new target" }))
                .await
                .unwrap()
        });
        server.configure(&next_address).unwrap();
        let response = tokio::time::timeout(Duration::from_secs(2), request)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let client = reqwest::Client::builder().no_proxy().build().unwrap();
        assert_eq!(
            client
                .get(format!("{}/info", server.origin))
                .send()
                .await
                .unwrap()
                .text()
                .await
                .unwrap(),
            "new target"
        );
        server.wait().await;
        backend_task.abort();
        next_task.abort();
    }

    #[tokio::test]
    async fn shutdown_cancels_pending_backend_requests() {
        let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .await
            .unwrap();
        let backend = format!("http://{}/", listener.local_addr().unwrap());
        let (entered, mut received) = tokio::sync::mpsc::channel::<()>(1);
        let app = Router::new().fallback(move || {
            let entered = entered.clone();
            async move {
                entered.send(()).await.unwrap();
                std::future::pending::<Response>().await
            }
        });
        let backend_task = tokio::spawn(async { axum::serve(listener, app).await.unwrap() });
        let server = start(0, Some(backend)).await.unwrap();
        let url = format!("{}/api/info", server.origin);
        let request = tokio::spawn(async move {
            reqwest::Client::builder()
                .no_proxy()
                .build()
                .unwrap()
                .get(url)
                .send()
                .await
        });
        tokio::time::timeout(Duration::from_secs(2), received.recv())
            .await
            .unwrap();
        server.wait().await;
        let response = tokio::time::timeout(Duration::from_secs(2), request)
            .await
            .unwrap()
            .unwrap();
        if let Ok(response) = response {
            assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        }
        backend_task.abort();
    }
}
