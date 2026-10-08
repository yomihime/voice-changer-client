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
use std::{error::Error, sync::Arc, time::Duration};
use tokio::{net::TcpListener, sync::watch, task::JoinHandle};
use tokio_tungstenite::tungstenite::{client::IntoClientRequest, Message as UpstreamMessage};

static ASSETS: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../dist");
type ServerError = Box<dyn Error + Send + Sync>;

#[derive(Clone)]
struct ServerState {
    origin: String,
    authority: String,
    backend: Option<reqwest::Url>,
    client: reqwest::Client,
    stop: watch::Receiver<bool>,
}

pub struct RunningServer {
    pub origin: String,
    stop: watch::Sender<bool>,
    task: Option<JoinHandle<()>>,
}

impl RunningServer {
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

fn parse_backend(value: &str) -> Result<reqwest::Url, ServerError> {
    let url = reqwest::Url::parse(value)?;
    let explicit_port = value
        .strip_prefix("http://127.0.0.1:")
        .map(|tail| tail.strip_suffix('/').unwrap_or(tail))
        .filter(|port| !port.is_empty() && port.bytes().all(|byte| byte.is_ascii_digit()))
        .and_then(|port| port.parse::<u16>().ok())
        .is_some_and(|port| port != 0);
    if url.scheme() != "http"
        || url.host_str() != Some("127.0.0.1")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
        || !explicit_port
    {
        return Err("Backend must be http://127.0.0.1:<port>/".into());
    }
    Ok(url)
}

pub async fn start(port: u16, backend: Option<String>) -> Result<RunningServer, ServerError> {
    let backend = backend.as_deref().map(parse_backend).transpose()?;
    let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, port)).await?;
    let authority = listener.local_addr()?.to_string();
    let origin = format!("http://{authority}");
    if backend
        .as_ref()
        .is_some_and(|url| url.origin().ascii_serialization() == origin)
    {
        return Err("Frontend and backend ports must differ".into());
    }
    let client = reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(300))
        .build()?;
    let (stop, receiver) = watch::channel(false);
    let state = Arc::new(ServerState {
        origin: origin.clone(),
        authority,
        backend,
        client,
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
        || path.contains(['\0', '\\'])
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
        || path == "/vcclient.log"
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
        _ = cancelled(state.stop.clone()) => error(StatusCode::SERVICE_UNAVAILABLE, "Client is closing"),
        response = dispatch(state.clone(), request, path) => response,
    }
}

async fn dispatch(state: Arc<ServerState>, request: Request, path: String) -> Response {
    if proxy_path(&path) {
        let Some(backend) = &state.backend else {
            return error(StatusCode::SERVICE_UNAVAILABLE, "No 2.x backend configured");
        };
        let path_query = request
            .uri()
            .path_and_query()
            .map_or("/", |value| value.as_str());
        let target = format!("{}{}", backend.origin().ascii_serialization(), path_query);
        if request
            .headers()
            .get(header::UPGRADE)
            .is_some_and(|value| value.as_bytes().eq_ignore_ascii_case(b"websocket"))
        {
            if !path.starts_with("/socket.io/") {
                return error(StatusCode::BAD_REQUEST, "Unsupported WebSocket path");
            }
            return proxy_websocket(state, request, target).await;
        }
        return proxy_http(state, request, target).await;
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

async fn proxy_http(state: Arc<ServerState>, request: Request, target: String) -> Response {
    let (parts, body) = request.into_parts();
    let upstream = state
        .client
        .request(parts.method, target)
        .headers(end_to_end_headers(&parts.headers))
        .body(reqwest::Body::wrap_stream(body.into_data_stream()))
        .send()
        .await;
    let Ok(upstream) = upstream else {
        return error(StatusCode::BAD_GATEWAY, "Backend request failed");
    };
    let status = upstream.status();
    let headers = end_to_end_headers(upstream.headers());
    let stream = upstream.bytes_stream();
    // Dropping the response or closing the application cancels an unfinished upload/download.
    let stream = futures_util::stream::unfold(
        (Box::pin(stream), state.stop.clone()),
        |(mut stream, stop)| async move {
            tokio::select! {
                _ = cancelled(stop.clone()) => None,
                next = stream.next() => next.map(|chunk| (chunk, (stream, stop))),
            }
        },
    );
    let mut response = Response::new(Body::from_stream(stream));
    *response.status_mut() = status;
    *response.headers_mut() = headers;
    response
}

async fn proxy_websocket(state: Arc<ServerState>, request: Request, target: String) -> Response {
    let (mut parts, _) = request.into_parts();
    let Ok(mut upgrade) = WebSocketUpgrade::from_request_parts(&mut parts, &()).await else {
        return error(StatusCode::BAD_REQUEST, "Invalid WebSocket handshake");
    };
    let Ok(mut upstream_request) = target.replacen("http:", "ws:", 1).into_client_request() else {
        return error(StatusCode::BAD_GATEWAY, "Invalid backend WebSocket URL");
    };
    // Preserve application authentication and subprotocols, but generate a fresh handshake.
    for (name, value) in end_to_end_headers(&parts.headers).iter() {
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
    let connected = tokio::time::timeout(
        Duration::from_secs(10),
        tokio_tungstenite::connect_async(upstream_request),
    )
    .await;
    let Ok(Ok((upstream, reply))) = connected else {
        return error(
            StatusCode::BAD_GATEWAY,
            "Backend WebSocket connection failed",
        );
    };
    if let Some(protocol) = reply.headers().get("sec-websocket-protocol") {
        upgrade.set_selected_protocol(protocol.clone());
    }
    upgrade.on_upgrade(move |socket| bridge_websocket(socket, upstream, state.stop.clone()))
}

async fn bridge_websocket(
    socket: WebSocket,
    upstream: tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    stop: watch::Receiver<bool>,
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
    tokio::select! { _ = cancelled(stop) => {}, _ = to_backend => {}, _ = to_browser => {} }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restrict_backend_and_paths() {
        for value in [
            "https://127.0.0.1:18000/",
            "http://localhost:18000/",
            "http://127.1:18000/",
            "http://127.0.0.1/",
            "http://127.0.0.1:0/",
            "http://user@127.0.0.1:18000/",
            "http://127.0.0.1:18000/api/",
            "http://127.0.0.1:18000/api/..",
            "http://127.0.0.1:18000/?x=1",
            "http://127.0.0.1:18000/#x",
        ] {
            assert!(parse_backend(value).is_err(), "{value}");
        }
        assert!(parse_backend("http://127.0.0.1:18000/").is_ok());
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
        assert_eq!(
            client
                .get(format!("{}/api/info", server.origin))
                .send()
                .await
                .unwrap()
                .status(),
            StatusCode::BAD_GATEWAY
        );
        server.wait().await;
    }

    #[tokio::test]
    async fn websocket_roundtrip_and_shutdown() {
        async fn echo(upgrade: WebSocketUpgrade, uri: axum::extract::OriginalUri) -> Response {
            assert_eq!(uri.query(), Some("EIO=4&transport=websocket"));
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
        let backend = format!("http://{}/", listener.local_addr().unwrap());
        let backend_task = tokio::spawn(async {
            axum::serve(
                listener,
                Router::new().route("/socket.io/", axum::routing::get(echo)),
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
        server.wait().await;
        let closed = tokio::time::timeout(Duration::from_secs(2), socket.next()).await;
        assert!(closed.is_ok(), "WebSocket remained open after shutdown");
        backend_task.abort();
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
