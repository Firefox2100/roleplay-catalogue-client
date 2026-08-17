use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use rusqlite::{params, Connection};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
    time::Instant,
};
use tauri::{AppHandle, Manager};

static REQUEST_SEQUENCE: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LlmConfig {
    provider: String,
    base_url: String,
    api_key: String,
    model: String,
    context_window: u32,
    max_output_tokens: u32,
    temperature: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogueConfig {
    base_url: String,
    api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppConfig {
    locale: String,
    llm: LlmConfig,
    catalogue: CatalogueConfig,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BootstrapData {
    version: &'static str,
    config: AppConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResourceMetadata {
    name: String,
    description: String,
    visibility: String,
    tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogueResource {
    id: String,
    resource_type: String,
    author_id: String,
    metadata: ResourceMetadata,
    draft_data_id: Option<String>,
    cover_image_resource_id: Option<String>,
    created_at: String,
    updated_at: String,
    #[serde(default)]
    author_username: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResourceList {
    items: Vec<CatalogueResource>,
    next_offset: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CharacterDraft {
    id: String,
    resource_id: String,
    resource_version_id: Option<String>,
    created_at: String,
    updated_at: String,
    data: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct SelectedCharacter {
    resource: CatalogueResource,
    draft: Option<CharacterDraft>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateCharacterInput {
    name: String,
    description: String,
    visibility: String,
    tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct CurrentUser {
    id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CoverImage {
    media_type: String,
    data: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            locale: "en-GB".into(),
            llm: LlmConfig {
                provider: "openai".into(),
                base_url: "https://api.openai.com/v1".into(),
                api_key: String::new(),
                model: "gpt-4.1".into(),
                context_window: 128_000,
                max_output_tokens: 4_096,
                temperature: 0.7,
            },
            catalogue: CatalogueConfig {
                base_url: String::new(),
                api_key: String::new(),
            },
        }
    }
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    Ok(directory.join("client.sqlite3"))
}

fn connection(app: &AppHandle) -> Result<Connection, String> {
    let db = Connection::open(database_path(app)?).map_err(|e| e.to_string())?;
    db.execute_batch("CREATE TABLE IF NOT EXISTS app_configuration (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);").map_err(|e| e.to_string())?;
    Ok(db)
}

fn validate(config: &AppConfig) -> Result<(), String> {
    if !matches!(config.locale.as_str(), "en-GB" | "zh-CN") {
        return Err("Unsupported locale".into());
    }
    if !matches!(
        config.llm.provider.as_str(),
        "openai" | "anthropic" | "ollama" | "openai-compatible"
    ) {
        return Err("Unsupported provider".into());
    }
    if config.llm.context_window < 1_024
        || config.llm.max_output_tokens == 0
        || !(0.0..=2.0).contains(&config.llm.temperature)
    {
        return Err("Invalid model parameters".into());
    }
    Ok(())
}

fn read_config(app: &AppHandle) -> Result<AppConfig, String> {
    let db = connection(app)?;
    let value = db.query_row(
        "SELECT value FROM app_configuration WHERE id = 1",
        [],
        |row| row.get::<_, String>(0),
    );
    match value {
        Ok(json) => serde_json::from_str(&json).map_err(|e| e.to_string()),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(AppConfig::default()),
        Err(e) => Err(e.to_string()),
    }
}

fn catalogue_urls(config: &AppConfig, path: &str) -> Result<Vec<String>, String> {
    let base = config.catalogue.base_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Err("Catalogue base URL is not configured".into());
    }
    let mut urls = vec![format!("{base}{path}")];
    if !base.ends_with("/api") {
        urls.push(format!("{base}/api{path}"));
    }
    Ok(urls)
}

struct CatalogueResponse {
    request_id: u64,
    url: String,
    status: reqwest::StatusCode,
    content_type: String,
    body: Vec<u8>,
}

fn response_excerpt(body: &[u8]) -> String {
    const LIMIT: usize = 500;
    let text = String::from_utf8_lossy(body);
    let mut excerpt: String = text.chars().take(LIMIT).collect();
    if text.chars().count() > LIMIT {
        excerpt.push('…');
    }
    excerpt.replace(['\r', '\n'], " ")
}

fn looks_like_frontend_html(content_type: &str, body: &[u8]) -> bool {
    content_type.to_ascii_lowercase().contains("text/html")
        || matches!(
            body.iter().find(|byte| !byte.is_ascii_whitespace()),
            Some(b'<')
        )
}

async fn catalogue_response(
    app: &AppHandle,
    method: reqwest::Method,
    path: &str,
    body: Option<serde_json::Value>,
) -> Result<CatalogueResponse, String> {
    let config = read_config(app)?;
    if config.catalogue.api_key.trim().is_empty() {
        return Err("Catalogue API key is not configured".into());
    }
    let client = reqwest::Client::builder()
        .https_only(false)
        .build()
        .map_err(|e| e.to_string())?;
    let urls = catalogue_urls(&config, path)?;
    for (index, url) in urls.iter().enumerate() {
        let request_id = REQUEST_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let started = Instant::now();
        eprintln!("[catalogue:{request_id}] -> {method} {url}");
        let mut request = client
            .request(method.clone(), url)
            .bearer_auth(config.catalogue.api_key.trim());
        if let Some(value) = &body {
            request = request.json(value);
        }
        let response = request.send().await.map_err(|error| {
            eprintln!(
                "[catalogue:{request_id}] network error after {:?}: {error}",
                started.elapsed()
            );
            format!("Catalogue request {request_id} failed for {method} {url}: {error}")
        })?;
        let status = response.status();
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("unknown")
            .to_owned();
        let response_body = response.bytes().await.map_err(|error| {
            format!("Catalogue request {request_id} could not read the response from {url}: {error}")
        })?.to_vec();
        eprintln!(
            "[catalogue:{request_id}] <- {status} ({content_type}, {} bytes, {:?})",
            response_body.len(),
            started.elapsed()
        );

        let has_fallback = index + 1 < urls.len();
        let likely_frontend_response =
            status.is_success() && looks_like_frontend_html(&content_type, &response_body);
        if has_fallback
            && (matches!(
                status,
                reqwest::StatusCode::NOT_FOUND | reqwest::StatusCode::METHOD_NOT_ALLOWED
            ) || likely_frontend_response)
        {
            eprintln!("[catalogue:{request_id}] endpoint not found at this base; trying /api");
            continue;
        }
        return Ok(CatalogueResponse {
            request_id,
            url: url.clone(),
            status,
            content_type,
            body: response_body,
        });
    }
    unreachable!("catalogue_urls always returns at least one URL")
}

fn decode_catalogue_json<T: DeserializeOwned>(response: CatalogueResponse) -> Result<T, String> {
    if !response.status.is_success() {
        return Err(format!(
            "Catalogue request {} returned {} for {}: {}",
            response.request_id,
            response.status,
            response.url,
            response_excerpt(&response.body),
        ));
    }
    serde_json::from_slice(&response.body).map_err(|error| {
        format!(
            "Catalogue request {} returned an invalid JSON response from {} (content-type {}): {error}. Response: {}",
            response.request_id,
            response.url,
            response.content_type,
            response_excerpt(&response.body),
        )
    })
}

async fn catalogue_json<T: DeserializeOwned>(
    app: &AppHandle,
    method: reqwest::Method,
    path: &str,
    body: Option<serde_json::Value>,
) -> Result<T, String> {
    decode_catalogue_json(catalogue_response(app, method, path, body).await?)
}

async fn fetch_draft(app: &AppHandle, resource_id: &str) -> Result<Option<CharacterDraft>, String> {
    let path = format!("/resources/{resource_id}/data");
    let response = catalogue_response(app, reqwest::Method::GET, &path, None).await?;
    if response.status == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    decode_catalogue_json(response).map(Some)
}

#[tauri::command]
async fn fetch_character_cover(
    app: AppHandle,
    resource_id: String,
) -> Result<Option<CoverImage>, String> {
    let path = format!("/images/covers/resources/{resource_id}");
    let response = catalogue_response(&app, reqwest::Method::GET, &path, None).await?;
    if response.status == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !response.status.is_success() {
        return Err(format!(
            "Catalogue request {} returned {} for {}: {}",
            response.request_id,
            response.status,
            response.url,
            response_excerpt(&response.body),
        ));
    }
    let media_type = response
        .content_type
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    if !media_type.starts_with("image/") {
        return Err(format!(
            "Catalogue request {} returned {} instead of an image from {}",
            response.request_id, response.content_type, response.url,
        ));
    }
    Ok(Some(CoverImage {
        media_type,
        data: BASE64.encode(response.body),
    }))
}

#[tauri::command]
fn load_bootstrap(app: AppHandle) -> Result<BootstrapData, String> {
    Ok(BootstrapData {
        version: env!("CARGO_PKG_VERSION"),
        config: read_config(&app)?,
    })
}

#[tauri::command]
fn save_configuration(app: AppHandle, config: AppConfig) -> Result<AppConfig, String> {
    validate(&config)?;
    let json = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    connection(&app)?.execute("INSERT INTO app_configuration (id, value, updated_at) VALUES (1, ?1, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP", params![json]).map_err(|e| e.to_string())?;
    Ok(config)
}

#[tauri::command]
async fn list_owned_characters(app: AppHandle) -> Result<ResourceList, String> {
    let user: CurrentUser = catalogue_json(&app, reqwest::Method::GET, "/auth/me", None).await?;
    let mut resources: ResourceList = catalogue_json(
        &app,
        reqwest::Method::GET,
        "/resources?resourceType=sillytavern%2Fcharacter&limit=100",
        None,
    )
    .await?;
    resources
        .items
        .retain(|resource| resource.author_id == user.id);
    Ok(resources)
}

#[tauri::command]
async fn select_character(
    app: AppHandle,
    resource_id: String,
) -> Result<SelectedCharacter, String> {
    let path = format!("/resources/{resource_id}");
    let resource: CatalogueResource =
        catalogue_json(&app, reqwest::Method::GET, &path, None).await?;
    if resource.resource_type != "sillytavern/character" {
        return Err("Selected resource is not a character card".into());
    }
    let draft = fetch_draft(&app, &resource.id).await?;
    Ok(SelectedCharacter { resource, draft })
}

#[tauri::command]
async fn create_character(
    app: AppHandle,
    input: CreateCharacterInput,
) -> Result<SelectedCharacter, String> {
    if input.name.trim().is_empty() {
        return Err("Character name is required".into());
    }
    let body = serde_json::json!({
        "resourceType": "sillytavern/character",
        "name": input.name.trim(),
        "description": input.description.trim(),
        "visibility": input.visibility,
        "tags": input.tags,
    });
    let resource: CatalogueResource =
        catalogue_json(&app, reqwest::Method::POST, "/resources", Some(body)).await?;
    let draft = fetch_draft(&app, &resource.id).await?;
    Ok(SelectedCharacter { resource, draft })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_bootstrap,
            save_configuration,
            list_owned_characters,
            fetch_character_cover,
            select_character,
            create_character
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{catalogue_urls, looks_like_frontend_html, response_excerpt, AppConfig};

    #[test]
    fn tries_direct_and_deployed_api_layouts() {
        let mut config = AppConfig::default();
        config.catalogue.base_url = "https://catalogue.example/".into();
        assert_eq!(
            catalogue_urls(&config, "/auth/me").unwrap(),
            [
                "https://catalogue.example/auth/me",
                "https://catalogue.example/api/auth/me",
            ]
        );

        config.catalogue.base_url = "https://catalogue.example/api".into();
        assert_eq!(
            catalogue_urls(&config, "/auth/me").unwrap(),
            ["https://catalogue.example/api/auth/me"]
        );
    }

    #[test]
    fn detects_frontend_html_without_mistaking_images_for_it() {
        assert!(looks_like_frontend_html("text/html", b"not inspected"));
        assert!(looks_like_frontend_html("text/plain", b" <!doctype html>"));
        assert!(!looks_like_frontend_html("image/png", b"\x89PNG"));
    }

    #[test]
    fn response_excerpt_is_single_line_and_bounded() {
        let excerpt = response_excerpt(format!("first\n{}", "x".repeat(600)).as_bytes());
        assert!(!excerpt.contains('\n'));
        assert!(excerpt.ends_with('…'));
    }
}
