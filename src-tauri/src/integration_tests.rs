use super::*;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

fn read_request(stream: &mut TcpStream) -> String {
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .unwrap();
    let mut bytes = Vec::new();
    let mut buffer = [0u8; 4096];
    let mut expected = None;
    loop {
        let count = stream.read(&mut buffer).unwrap();
        if count == 0 {
            break;
        }
        bytes.extend_from_slice(&buffer[..count]);
        if expected.is_none() {
            if let Some(header_end) = bytes.windows(4).position(|window| window == b"\r\n\r\n") {
                let headers = String::from_utf8_lossy(&bytes[..header_end]);
                let content_length = headers
                    .lines()
                    .find_map(|line| {
                        let (name, value) = line.split_once(':')?;
                        name.eq_ignore_ascii_case("content-length")
                            .then(|| value.trim().parse::<usize>().ok())
                            .flatten()
                    })
                    .unwrap_or(0);
                expected = Some(header_end + 4 + content_length);
            }
        }
        if expected.is_some_and(|length| bytes.len() >= length) {
            break;
        }
    }
    String::from_utf8(bytes).unwrap()
}

fn mock_server(status: u16, body: serde_json::Value) -> (String, mpsc::Receiver<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        let request = read_request(&mut stream);
        let _ = sender.send(request);
        let payload = serde_json::to_vec(&body).unwrap();
        let reason = if status == 200 { "OK" } else { "Error" };
        write!(
            stream,
            "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            payload.len(),
        ).unwrap();
        stream.write_all(&payload).unwrap();
    });
    (format!("http://{address}"), receiver)
}

fn llm_config(provider: &str, base_url: String) -> LlmConfig {
    LlmConfig {
        provider: provider.into(),
        base_url,
        api_key: if provider == "ollama" {
            String::new()
        } else {
            "integration-secret".into()
        },
        model: "test-model".into(),
        context_window: 8192,
        max_output_tokens: 256,
        temperature: 0.4,
    }
}

#[test]
fn provider_adapters_exchange_real_http_for_all_supported_protocols() {
    let cases = [
        (
            "openai",
            "/v1/chat/completions",
            serde_json::json!({"choices": [{"message": {"content": "openai-result"}}]}),
            "openai-result",
        ),
        (
            "openai-compatible",
            "/v1/chat/completions",
            serde_json::json!({"choices": [{"message": {"content": "compatible-result"}}]}),
            "compatible-result",
        ),
        (
            "anthropic",
            "/v1/messages",
            serde_json::json!({"content": [{"type": "text", "text": "anthropic-result"}]}),
            "anthropic-result",
        ),
        (
            "ollama",
            "/api/chat",
            serde_json::json!({"message": {"role": "assistant", "content": "ollama-result"}}),
            "ollama-result",
        ),
    ];
    for (provider, path, response, expected) in cases {
        let (base_url, request) = mock_server(200, response);
        let result = tauri::async_runtime::block_on(call_llm(
            &llm_config(provider, base_url),
            &[],
            "Return a small structured response.",
            true,
            None,
        ))
        .unwrap();
        assert_eq!(result, expected);
        let request = request.recv_timeout(Duration::from_secs(5)).unwrap();
        assert!(request.starts_with(&format!("POST {path} HTTP/1.1")));
        assert!(request.contains("\"model\":\"test-model\""));
        if provider == "anthropic" {
            assert!(request
                .to_ascii_lowercase()
                .contains("x-api-key: integration-secret"));
        } else if provider != "ollama" {
            assert!(request
                .to_ascii_lowercase()
                .contains("authorization: bearer integration-secret"));
        }
    }
}

#[test]
fn provider_errors_do_not_expose_credentials() {
    let (base_url, _) = mock_server(401, serde_json::json!({"error": {"message": "denied"}}));
    let error = tauri::async_runtime::block_on(call_llm(
        &llm_config("openai", base_url),
        &[],
        "Test.",
        true,
        None,
    ))
    .unwrap_err();
    assert!(error.contains("denied"));
    assert!(!error.contains("integration-secret"));
}

#[test]
fn playground_provider_request_is_plain_text_and_injects_late_system_content_after_history() {
    let (base_url, request) = mock_server(
        200,
        serde_json::json!({"choices": [{"message": {"content": "in-character reply"}}]}),
    );
    let history = vec![AiMessage {
        id: "trial".into(),
        conversation_id: String::new(),
        role: "user".into(),
        content: "Hello".into(),
        proposals: Vec::new(),
        created_at: String::new(),
    }];
    let reply = tauri::async_runtime::block_on(call_llm(
        &llm_config("openai", base_url),
        &history,
        "Character context",
        false,
        Some("Post-history instruction"),
    ))
    .unwrap();
    assert_eq!(reply, "in-character reply");
    let request = request.recv_timeout(Duration::from_secs(5)).unwrap();
    assert!(!request.contains("response_format"));
    let user = request.find("Hello").unwrap();
    let late = request.find("Post-history instruction").unwrap();
    assert!(user < late);
}

#[test]
fn catalogue_adapter_sends_bearer_auth_and_decodes_service_json() {
    let (base_url, request) = mock_server(200, serde_json::json!({"id": "catalogue-user"}));
    let mut config = AppConfig::default();
    config.catalogue.base_url = base_url;
    config.catalogue.api_key = "catalogue-secret".into();
    let response = tauri::async_runtime::block_on(catalogue_response_with_config(
        &config,
        reqwest::Method::GET,
        "/auth/me",
        None,
        None,
    ))
    .unwrap();
    let user: CurrentUser = decode_catalogue_json(response).unwrap();
    assert_eq!(user.id, "catalogue-user");
    let request = request.recv_timeout(Duration::from_secs(5)).unwrap();
    assert!(request.starts_with("GET /auth/me HTTP/1.1"));
    assert!(request
        .to_ascii_lowercase()
        .contains("authorization: bearer catalogue-secret"));
}
