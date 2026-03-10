//! Session planner import/export and template persistence

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
#[cfg(not(desktop))]
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

use super::storage::StorageError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionTemplateEntry {
    pub id: String,
    pub name: String,
    pub draft: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct SessionTemplateData {
    templates: Vec<SessionTemplateEntry>,
}

fn get_session_data_dir(app: &AppHandle) -> Result<PathBuf, StorageError> {
    #[cfg(desktop)]
    let base_dir = crate::platform::path_config::resolve_data_dir(app)?;

    #[cfg(not(desktop))]
    let base_dir = {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|_| StorageError::AppDataDirNotFound)?;
        let d = app_data_dir.join("skymap");
        if !d.exists() {
            fs::create_dir_all(&d)?;
        }
        d
    };

    let session_dir = base_dir.join("session");
    if !session_dir.exists() {
        fs::create_dir_all(&session_dir)?;
    }
    Ok(session_dir)
}

fn get_templates_path(app: &AppHandle) -> Result<PathBuf, StorageError> {
    Ok(get_session_data_dir(app)?.join("templates.json"))
}

fn load_templates_internal(app: &AppHandle) -> Result<SessionTemplateData, StorageError> {
    let path = get_templates_path(app)?;
    if !path.exists() {
        return Ok(SessionTemplateData::default());
    }
    let content = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&content)?)
}

fn save_templates_internal(app: &AppHandle, data: &SessionTemplateData) -> Result<(), StorageError> {
    let path = get_templates_path(app)?;
    let serialized = serde_json::to_string_pretty(data)?;
    fs::write(path, serialized)?;
    Ok(())
}

fn extension_for_format(format: &str) -> &'static str {
    match format {
        "markdown" => "md",
        "json" => "json",
        "nina-xml" => "xml",
        "csv" => "csv",
        "sgp-csv" => "csv",
        _ => "txt",
    }
}

#[tauri::command]
pub async fn export_session_plan(
    app: AppHandle,
    content: String,
    format: String,
    path: Option<String>,
) -> Result<String, StorageError> {
    let target_path = if let Some(path) = path {
        PathBuf::from(path)
    } else {
        let ext = extension_for_format(&format);
        let file_path = app
            .dialog()
            .file()
            .set_title("Export Session Plan")
            .add_filter("Session Plan", &[ext])
            .set_file_name(&format!("session-plan.{}", ext))
            .blocking_save_file();

        match file_path {
            Some(path) => path.into_path().map_err(|_| StorageError::AppDataDirNotFound)?,
            None => {
                return Err(StorageError::Io(std::io::Error::new(
                    std::io::ErrorKind::Interrupted,
                    "Export cancelled",
                )));
            }
        }
    };

    fs::write(&target_path, content)?;
    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn import_session_plan(
    app: AppHandle,
    path: Option<String>,
) -> Result<String, StorageError> {
    let source_path = if let Some(path) = path {
        PathBuf::from(path)
    } else {
        let file_path = app
            .dialog()
            .file()
            .set_title("Import Session Plan")
            .add_filter("Session Plan", &["txt", "md", "json", "xml", "csv"])
            .blocking_pick_file();

        match file_path {
            Some(path) => path.into_path().map_err(|_| StorageError::AppDataDirNotFound)?,
            None => {
                return Err(StorageError::Io(std::io::Error::new(
                    std::io::ErrorKind::Interrupted,
                    "Import cancelled",
                )));
            }
        }
    };

    let content = fs::read_to_string(&source_path)?;
    Ok(content)
}

#[tauri::command]
pub async fn save_session_template(
    app: AppHandle,
    name: String,
    draft: String,
) -> Result<SessionTemplateEntry, StorageError> {
    let now = Utc::now();
    let draft_json: serde_json::Value = serde_json::from_str(&draft)?;
    let mut data = load_templates_internal(&app)?;

    if let Some(existing) = data.templates.iter_mut().find(|template| template.name == name) {
        existing.draft = draft_json;
        existing.updated_at = now;
        let updated = existing.clone();
        save_templates_internal(&app, &data)?;
        return Ok(updated);
    }

    let entry = SessionTemplateEntry {
        id: format!("template-{}-{}", now.timestamp_millis(), data.templates.len() + 1),
        name,
        draft: draft_json,
        created_at: now,
        updated_at: now,
    };
    data.templates.push(entry.clone());
    save_templates_internal(&app, &data)?;
    Ok(entry)
}

#[tauri::command]
pub async fn load_session_templates(app: AppHandle) -> Result<Vec<SessionTemplateEntry>, StorageError> {
    let data = load_templates_internal(&app)?;
    Ok(data.templates)
}
