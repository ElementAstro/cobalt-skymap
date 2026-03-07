//! Observation log module
//! Records and manages observation sessions and individual observations

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use super::storage::StorageError;
use crate::utils::generate_id;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTarget {
    pub id: String,
    pub target_id: String,
    pub target_name: String,
    pub scheduled_start: DateTime<Utc>,
    pub scheduled_end: DateTime<Utc>,
    pub scheduled_duration_minutes: i64,
    pub order: usize,
    pub status: String,
    pub observation_ids: Vec<String>,
    pub actual_start: Option<DateTime<Utc>>,
    pub actual_end: Option<DateTime<Utc>>,
    pub result_notes: Option<String>,
    pub skip_reason: Option<String>,
    pub completion_summary: Option<String>,
    pub unplanned: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionSummary {
    pub completed_targets: usize,
    pub skipped_targets: usize,
    pub failed_targets: usize,
    pub total_targets: usize,
    pub total_observations: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObservationSession {
    pub id: String,
    pub date: NaiveDate,
    pub location_id: Option<String>,
    pub location_name: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub weather: Option<WeatherConditions>,
    pub seeing: Option<u8>,
    pub transparency: Option<u8>,
    pub equipment_ids: Vec<String>,
    #[serde(default)]
    pub bortle_class: Option<u8>,
    pub notes: Option<String>,
    pub observations: Vec<Observation>,
    pub source_plan_id: Option<String>,
    pub source_plan_name: Option<String>,
    pub execution_status: Option<String>,
    pub execution_targets: Option<Vec<ExecutionTarget>>,
    pub weather_snapshot: Option<serde_json::Value>,
    pub execution_summary: Option<ExecutionSummary>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherConditions {
    pub temperature: Option<f64>,
    pub humidity: Option<f64>,
    pub wind_speed: Option<f64>,
    pub cloud_cover: Option<u8>,
    pub moon_phase: Option<f64>,
    pub moon_illumination: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Observation {
    pub id: String,
    pub object_name: String,
    pub object_type: Option<String>,
    pub ra: Option<f64>,
    pub dec: Option<f64>,
    pub constellation: Option<String>,
    pub observed_at: DateTime<Utc>,
    pub telescope_id: Option<String>,
    pub eyepiece_id: Option<String>,
    pub camera_id: Option<String>,
    pub filter_id: Option<String>,
    pub magnification: Option<f64>,
    pub rating: Option<u8>,
    pub difficulty: Option<u8>,
    pub notes: Option<String>,
    pub sketch_path: Option<String>,
    pub image_paths: Vec<String>,
    pub execution_target_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePlannedSessionTarget {
    pub id: String,
    pub target_id: String,
    pub target_name: String,
    pub scheduled_start: String,
    pub scheduled_end: String,
    pub scheduled_duration_minutes: i64,
    pub order: usize,
    pub status: String,
    pub observation_ids: Vec<String>,
    pub actual_start: Option<String>,
    pub actual_end: Option<String>,
    pub result_notes: Option<String>,
    pub skip_reason: Option<String>,
    pub completion_summary: Option<String>,
    pub unplanned: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePlannedSessionPayload {
    pub plan_date: String,
    pub location_id: Option<String>,
    pub location_name: Option<String>,
    pub source_plan_id: String,
    pub source_plan_name: String,
    pub notes: Option<String>,
    pub weather_snapshot: Option<serde_json::Value>,
    pub execution_targets: Vec<CreatePlannedSessionTarget>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ObservationLogData {
    pub sessions: Vec<ObservationSession>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObservationStats {
    pub total_sessions: usize,
    pub total_observations: usize,
    pub unique_objects: usize,
    pub total_hours: f64,
    pub objects_by_type: Vec<(String, usize)>,
    pub monthly_counts: Vec<(String, usize)>,
}

fn get_log_path(app: &AppHandle) -> Result<PathBuf, StorageError> {
    let app_data_dir = app.path().app_data_dir().map_err(|_| StorageError::AppDataDirNotFound)?;
    let dir = app_data_dir.join("skymap").join("logs");
    if !dir.exists() { fs::create_dir_all(&dir)?; }
    Ok(dir.join("observation_log.json"))
}

fn invalid_data_error(message: String) -> StorageError {
    StorageError::Json(serde_json::Error::io(std::io::Error::new(
        std::io::ErrorKind::InvalidData,
        message,
    )))
}

fn parse_session_date(value: &str) -> Result<NaiveDate, StorageError> {
    if let Ok(date) = NaiveDate::parse_from_str(value, "%Y-%m-%d") {
        return Ok(date);
    }

    if let Ok(date_time) = chrono::DateTime::parse_from_rfc3339(value) {
        return Ok(date_time.naive_utc().date());
    }

    Err(invalid_data_error(format!("Invalid session date: {value}")))
}

fn parse_execution_datetime(value: &str) -> Result<DateTime<Utc>, StorageError> {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|date_time| date_time.with_timezone(&Utc))
        .map_err(|error| invalid_data_error(error.to_string()))
}

fn map_planned_target(target: CreatePlannedSessionTarget) -> Result<ExecutionTarget, StorageError> {
    Ok(ExecutionTarget {
        id: target.id,
        target_id: target.target_id,
        target_name: target.target_name,
        scheduled_start: parse_execution_datetime(&target.scheduled_start)?,
        scheduled_end: parse_execution_datetime(&target.scheduled_end)?,
        scheduled_duration_minutes: target.scheduled_duration_minutes,
        order: target.order,
        status: target.status,
        observation_ids: target.observation_ids,
        actual_start: target.actual_start
            .as_deref()
            .map(parse_execution_datetime)
            .transpose()?,
        actual_end: target.actual_end
            .as_deref()
            .map(parse_execution_datetime)
            .transpose()?,
        result_notes: target.result_notes,
        skip_reason: target.skip_reason,
        completion_summary: target.completion_summary,
        unplanned: target.unplanned,
    })
}

#[tauri::command]
pub async fn load_observation_log(app: AppHandle) -> Result<ObservationLogData, StorageError> {
    let path = get_log_path(&app)?;
    if !path.exists() { return Ok(ObservationLogData::default()); }
    let data = fs::read_to_string(&path)?;
    Ok(serde_json::from_str(&data)?)
}

#[tauri::command]
pub async fn save_observation_log(app: AppHandle, log: ObservationLogData) -> Result<(), StorageError> {
    let path = get_log_path(&app)?;
    fs::write(&path, serde_json::to_string_pretty(&log)?)?;
    log::info!("Saved observation log to {:?}", path);
    Ok(())
}

#[tauri::command]
pub async fn create_session(app: AppHandle, date: String, location_id: Option<String>, location_name: Option<String>) -> Result<ObservationSession, StorageError> {
    let mut log = load_observation_log(app.clone()).await?;
    let date = parse_session_date(&date)?;

    let session = ObservationSession {
        id: generate_id("session"), date, location_id, location_name,
        start_time: Some(Utc::now()), end_time: None, weather: None,
        seeing: None, transparency: None, equipment_ids: Vec::new(),
        bortle_class: None, notes: None, observations: Vec::new(),
        source_plan_id: None, source_plan_name: None, execution_status: None, execution_targets: None,
        weather_snapshot: None, execution_summary: None, created_at: Utc::now(), updated_at: Utc::now(),
    };
    log.sessions.push(session.clone());
    save_observation_log(app, log).await?;
    Ok(session)
}

#[tauri::command]
pub async fn create_planned_session(
    app: AppHandle,
    payload: CreatePlannedSessionPayload,
) -> Result<ObservationSession, StorageError> {
    let mut log = load_observation_log(app.clone()).await?;
    let date = parse_session_date(&payload.plan_date)?;
    let execution_targets = payload
        .execution_targets
        .into_iter()
        .map(map_planned_target)
        .collect::<Result<Vec<_>, _>>()?;
    let now = Utc::now();

    let session = ObservationSession {
        id: generate_id("session"),
        date,
        location_id: payload.location_id,
        location_name: payload.location_name,
        start_time: Some(now),
        end_time: None,
        weather: None,
        seeing: None,
        transparency: None,
        equipment_ids: Vec::new(),
        bortle_class: None,
        notes: payload.notes,
        observations: Vec::new(),
        source_plan_id: Some(payload.source_plan_id),
        source_plan_name: Some(payload.source_plan_name),
        execution_status: Some("active".to_string()),
        execution_targets: Some(execution_targets),
        weather_snapshot: payload.weather_snapshot,
        execution_summary: None,
        created_at: now,
        updated_at: now,
    };

    log.sessions.push(session.clone());
    save_observation_log(app, log).await?;
    Ok(session)
}

#[tauri::command]
pub async fn add_observation(app: AppHandle, session_id: String, observation: Observation) -> Result<ObservationSession, StorageError> {
    let mut log = load_observation_log(app.clone()).await?;
    let session = log.sessions.iter_mut().find(|s| s.id == session_id)
        .ok_or_else(|| StorageError::StoreNotFound(session_id.clone()))?;

    let mut obs = observation;
    obs.id = generate_id("obs");
    obs.observed_at = Utc::now();
    session.observations.push(obs);
    session.updated_at = Utc::now();

    let result = session.clone();
    save_observation_log(app, log).await?;
    Ok(result)
}

#[tauri::command]
pub async fn update_session(app: AppHandle, session: ObservationSession) -> Result<ObservationSession, StorageError> {
    let mut log = load_observation_log(app.clone()).await?;
    if let Some(existing) = log.sessions.iter_mut().find(|s| s.id == session.id) {
        existing.location_id = session.location_id;
        existing.location_name = session.location_name;
        existing.start_time = session.start_time;
        existing.end_time = session.end_time;
        existing.weather = session.weather;
        existing.seeing = session.seeing;
        existing.transparency = session.transparency;
        existing.equipment_ids = session.equipment_ids;
        existing.bortle_class = session.bortle_class;
        existing.notes = session.notes;
        existing.source_plan_id = session.source_plan_id;
        existing.source_plan_name = session.source_plan_name;
        existing.execution_status = session.execution_status;
        existing.execution_targets = session.execution_targets;
        existing.weather_snapshot = session.weather_snapshot;
        existing.execution_summary = session.execution_summary;
        existing.updated_at = Utc::now();
        let result = existing.clone();
        save_observation_log(app, log).await?;
        return Ok(result);
    }
    Err(StorageError::StoreNotFound(session.id))
}

#[tauri::command]
pub async fn end_session(app: AppHandle, session_id: String) -> Result<ObservationSession, StorageError> {
    let mut log = load_observation_log(app.clone()).await?;
    let session = log.sessions.iter_mut().find(|s| s.id == session_id)
        .ok_or_else(|| StorageError::StoreNotFound(session_id.clone()))?;
    session.end_time = Some(Utc::now());
    session.updated_at = Utc::now();
    let result = session.clone();
    save_observation_log(app, log).await?;
    Ok(result)
}

#[tauri::command]
pub async fn delete_session(app: AppHandle, session_id: String) -> Result<(), StorageError> {
    let mut log = load_observation_log(app.clone()).await?;
    log.sessions.retain(|s| s.id != session_id);
    save_observation_log(app, log).await?;
    Ok(())
}

#[tauri::command]
pub async fn update_observation(app: AppHandle, session_id: String, observation: Observation) -> Result<ObservationSession, StorageError> {
    let mut log = load_observation_log(app.clone()).await?;
    let session = log.sessions.iter_mut().find(|s| s.id == session_id)
        .ok_or_else(|| StorageError::StoreNotFound(session_id.clone()))?;

    if let Some(existing) = session.observations.iter_mut().find(|o| o.id == observation.id) {
        existing.object_name = observation.object_name;
        existing.object_type = observation.object_type;
        existing.ra = observation.ra;
        existing.dec = observation.dec;
        existing.constellation = observation.constellation;
        existing.telescope_id = observation.telescope_id;
        existing.eyepiece_id = observation.eyepiece_id;
        existing.camera_id = observation.camera_id;
        existing.filter_id = observation.filter_id;
        existing.magnification = observation.magnification;
        existing.rating = observation.rating;
        existing.difficulty = observation.difficulty;
        existing.notes = observation.notes;
        existing.sketch_path = observation.sketch_path;
        existing.image_paths = observation.image_paths;
    } else {
        return Err(StorageError::StoreNotFound(observation.id));
    }

    session.updated_at = Utc::now();
    let result = session.clone();
    save_observation_log(app, log).await?;
    Ok(result)
}

#[tauri::command]
pub async fn delete_observation(app: AppHandle, session_id: String, observation_id: String) -> Result<ObservationSession, StorageError> {
    let mut log = load_observation_log(app.clone()).await?;
    let session = log.sessions.iter_mut().find(|s| s.id == session_id)
        .ok_or_else(|| StorageError::StoreNotFound(session_id.clone()))?;

    let before = session.observations.len();
    session.observations.retain(|o| o.id != observation_id);
    if session.observations.len() == before {
        return Err(StorageError::StoreNotFound(observation_id));
    }

    session.updated_at = Utc::now();
    let result = session.clone();
    save_observation_log(app, log).await?;
    Ok(result)
}

#[tauri::command]
pub async fn get_observation_stats(app: AppHandle) -> Result<ObservationStats, StorageError> {
    let log = load_observation_log(app).await?;
    let total_sessions = log.sessions.len();
    let total_observations: usize = log.sessions.iter().map(|s| s.observations.len()).sum();

    let mut unique_objects = std::collections::HashSet::new();
    for session in &log.sessions {
        for obs in &session.observations { unique_objects.insert(obs.object_name.to_lowercase()); }
    }

    let total_hours: f64 = log.sessions.iter()
        .filter_map(|s| match (s.start_time, s.end_time) {
            (Some(start), Some(end)) => Some((end - start).num_minutes() as f64 / 60.0),
            _ => None,
        }).sum();

    let mut type_counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for session in &log.sessions {
        for obs in &session.observations {
            let obj_type = obs.object_type.clone().unwrap_or_else(|| "Unknown".to_string());
            *type_counts.entry(obj_type).or_insert(0) += 1;
        }
    }
    let mut objects_by_type: Vec<(String, usize)> = type_counts.into_iter().collect();
    objects_by_type.sort_by(|a, b| b.1.cmp(&a.1));

    let mut monthly: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for session in &log.sessions {
        let month = session.date.format("%Y-%m").to_string();
        *monthly.entry(month).or_insert(0) += session.observations.len();
    }
    let mut monthly_counts: Vec<(String, usize)> = monthly.into_iter().collect();
    monthly_counts.sort_by(|a, b| a.0.cmp(&b.0));

    Ok(ObservationStats { total_sessions, total_observations, unique_objects: unique_objects.len(), total_hours, objects_by_type, monthly_counts })
}

#[tauri::command]
pub async fn search_observations(app: AppHandle, query: String) -> Result<Vec<Observation>, StorageError> {
    let log = load_observation_log(app).await?;
    let query_lower = query.to_lowercase();
    let mut results = Vec::new();
    for session in log.sessions {
        for obs in session.observations {
            if obs.object_name.to_lowercase().contains(&query_lower)
                || obs.constellation.as_ref().map(|c| c.to_lowercase().contains(&query_lower)).unwrap_or(false)
                || obs.notes.as_ref().map(|n| n.to_lowercase().contains(&query_lower)).unwrap_or(false)
            {
                results.push(obs);
            }
        }
    }
    Ok(results)
}

#[tauri::command]
pub async fn export_observation_log(app: AppHandle, format: String) -> Result<String, StorageError> {
    let log = load_observation_log(app).await?;
    match format.as_str() {
        "json" => serde_json::to_string_pretty(&log)
            .map_err(|e| StorageError::Other(e.to_string())),
        "csv" => {
            let mut csv = String::from("Session Date,Location,Object,Type,RA,Dec,Constellation,Rating,Difficulty,Seeing,Transparency,Bortle,Notes\n");
            for session in &log.sessions {
                for obs in &session.observations {
                    csv.push_str(&format!(
                        "{},{},{},{},{},{},{},{},{},{},{},{},{}\n",
                        session.date,
                        session.location_name.as_deref().unwrap_or(""),
                        obs.object_name,
                        obs.object_type.as_deref().unwrap_or(""),
                        obs.ra.map(|v| v.to_string()).unwrap_or_default(),
                        obs.dec.map(|v| v.to_string()).unwrap_or_default(),
                        obs.constellation.as_deref().unwrap_or(""),
                        obs.rating.map(|v| v.to_string()).unwrap_or_default(),
                        obs.difficulty.map(|v| v.to_string()).unwrap_or_default(),
                        session.seeing.map(|v| v.to_string()).unwrap_or_default(),
                        session.transparency.map(|v| v.to_string()).unwrap_or_default(),
                        session.bortle_class.map(|v| v.to_string()).unwrap_or_default(),
                        obs.notes.as_deref().unwrap_or("").replace(',', ";"),
                    ));
                }
            }
            Ok(csv)
        }
        _ => Err(StorageError::Other(format!("Unsupported format: {}", format))),
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ------------------------------------------------------------------------
    // WeatherConditions Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_weather_conditions_serialization() {
        let weather = WeatherConditions {
            temperature: Some(15.5),
            humidity: Some(65.0),
            wind_speed: Some(10.0),
            cloud_cover: Some(20),
            moon_phase: Some(0.5),
            moon_illumination: Some(50.0),
        };

        let json = serde_json::to_string(&weather).unwrap();
        assert!(json.contains("15.5"));
        assert!(json.contains("humidity"));
        assert!(json.contains("moon_phase"));
    }

    #[test]
    fn test_weather_conditions_deserialization() {
        let json = r#"{
            "temperature": 20.0,
            "humidity": 50.0,
            "wind_speed": null,
            "cloud_cover": 10,
            "moon_phase": 0.25,
            "moon_illumination": null
        }"#;

        let weather: WeatherConditions = serde_json::from_str(json).unwrap();
        assert_eq!(weather.temperature, Some(20.0));
        assert!(weather.wind_speed.is_none());
        assert_eq!(weather.cloud_cover, Some(10));
    }

    #[test]
    fn test_weather_conditions_clone() {
        let weather = WeatherConditions {
            temperature: Some(10.0),
            humidity: None,
            wind_speed: None,
            cloud_cover: None,
            moon_phase: None,
            moon_illumination: None,
        };

        let cloned = weather.clone();
        assert_eq!(cloned.temperature, weather.temperature);
    }

    // ------------------------------------------------------------------------
    // Observation Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_observation_serialization() {
        let obs = Observation {
            id: "obs-1".to_string(),
            object_name: "M31".to_string(),
            object_type: Some("Galaxy".to_string()),
            ra: Some(10.68),
            dec: Some(41.27),
            constellation: Some("Andromeda".to_string()),
            observed_at: Utc::now(),
            telescope_id: Some("tel-1".to_string()),
            eyepiece_id: None,
            camera_id: Some("cam-1".to_string()),
            filter_id: None,
            magnification: Some(50.0),
            rating: Some(5),
            difficulty: Some(2),
            notes: Some("Beautiful spiral structure".to_string()),
            sketch_path: None,
            image_paths: vec!["img1.jpg".to_string()],
            execution_target_id: None,
        };

        let json = serde_json::to_string(&obs).unwrap();
        assert!(json.contains("M31"));
        assert!(json.contains("Galaxy"));
        assert!(json.contains("Andromeda"));
        assert!(json.contains("img1.jpg"));
    }

    #[test]
    fn test_observation_deserialization() {
        let json = r##"{
            "id": "o1",
            "object_name": "Orion Nebula",
            "object_type": "Nebula",
            "ra": 83.82,
            "dec": -5.39,
            "constellation": "Orion",
            "observed_at": "2024-01-15T22:30:00Z",
            "telescope_id": null,
            "eyepiece_id": null,
            "camera_id": null,
            "filter_id": null,
            "magnification": null,
            "rating": 4,
            "difficulty": 1,
            "notes": "Clear view",
            "sketch_path": null,
            "image_paths": []
        }"##;

        let obs: Observation = serde_json::from_str(json).unwrap();
        assert_eq!(obs.object_name, "Orion Nebula");
        assert_eq!(obs.rating, Some(4));
        assert!(obs.image_paths.is_empty());
    }

    // ------------------------------------------------------------------------
    // ObservationSession Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_observation_session_serialization() {
        let session = ObservationSession {
            id: "session-1".to_string(),
            date: NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
            location_id: Some("loc-1".to_string()),
            location_name: Some("Dark Site".to_string()),
            start_time: Some(Utc::now()),
            end_time: None,
            weather: None,
            seeing: Some(4),
            transparency: Some(3),
            equipment_ids: vec!["tel-1".to_string()],
            bortle_class: Some(3),
            notes: Some("Clear night".to_string()),
            observations: vec![],
            source_plan_id: None,
            source_plan_name: None,
            execution_status: None,
            execution_targets: None,
            weather_snapshot: None,
            execution_summary: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&session).unwrap();
        assert!(json.contains("session-1"));
        assert!(json.contains("Dark Site"));
        assert!(json.contains("2024-01-15"));
    }

    #[test]
    fn test_observation_session_deserialization() {
        let json = r##"{
            "id": "s1",
            "date": "2024-06-15",
            "location_id": null,
            "location_name": "Backyard",
            "start_time": "2024-06-15T21:00:00Z",
            "end_time": "2024-06-16T02:00:00Z",
            "weather": null,
            "seeing": 3,
            "transparency": 4,
            "equipment_ids": [],
            "notes": null,
            "observations": [],
            "created_at": "2024-06-15T20:00:00Z",
            "updated_at": "2024-06-16T02:00:00Z"
        }"##;

        let session: ObservationSession = serde_json::from_str(json).unwrap();
        assert_eq!(session.location_name, Some("Backyard".to_string()));
        assert_eq!(session.seeing, Some(3));
        assert!(session.end_time.is_some());
    }

    #[test]
    fn test_observation_session_deserializes_without_execution_fields() {
        let json = r##"{
            "id": "s1",
            "date": "2026-03-06",
            "location_id": null,
            "location_name": "Backyard",
            "start_time": null,
            "end_time": null,
            "weather": null,
            "seeing": null,
            "transparency": null,
            "equipment_ids": [],
            "notes": null,
            "observations": [],
            "created_at": "2026-03-06T12:00:00Z",
            "updated_at": "2026-03-06T12:00:00Z"
        }"##;

        let session: ObservationSession = serde_json::from_str(json).unwrap();
        assert!(session.source_plan_id.is_none());
        assert!(session.execution_targets.is_none());
    }

    // ------------------------------------------------------------------------
    // ObservationLogData Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_observation_log_data_default() {
        let data = ObservationLogData::default();
        assert!(data.sessions.is_empty());
    }

    #[test]
    fn test_observation_log_data_serialization() {
        let mut data = ObservationLogData::default();
        data.sessions.push(ObservationSession {
            id: "s1".to_string(),
            date: NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
            location_id: None,
            location_name: None,
            start_time: None,
            end_time: None,
            weather: None,
            seeing: None,
            transparency: None,
            equipment_ids: vec![],
            bortle_class: None,
            notes: None,
            observations: vec![],
            source_plan_id: None,
            source_plan_name: None,
            execution_status: None,
            execution_targets: None,
            weather_snapshot: None,
            execution_summary: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });

        let json = serde_json::to_string(&data).unwrap();
        assert!(json.contains("sessions"));
        assert!(json.contains("s1"));
    }

    // ------------------------------------------------------------------------
    // ObservationStats Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_observation_stats_serialization() {
        let stats = ObservationStats {
            total_sessions: 10,
            total_observations: 50,
            unique_objects: 35,
            total_hours: 45.5,
            objects_by_type: vec![
                ("Galaxy".to_string(), 15),
                ("Nebula".to_string(), 12),
            ],
            monthly_counts: vec![
                ("2024-01".to_string(), 20),
                ("2024-02".to_string(), 30),
            ],
        };

        let json = serde_json::to_string(&stats).unwrap();
        assert!(json.contains("total_sessions"));
        assert!(json.contains("50"));
        assert!(json.contains("Galaxy"));
    }

    #[test]
    fn test_observation_stats_deserialization() {
        let json = r#"{
            "total_sessions": 5,
            "total_observations": 20,
            "unique_objects": 15,
            "total_hours": 12.5,
            "objects_by_type": [["Cluster", 8]],
            "monthly_counts": []
        }"#;

        let stats: ObservationStats = serde_json::from_str(json).unwrap();
        assert_eq!(stats.total_sessions, 5);
        assert_eq!(stats.total_hours, 12.5);
        assert_eq!(stats.objects_by_type.len(), 1);
    }

    // ------------------------------------------------------------------------
    // Edge Cases
    // ------------------------------------------------------------------------

    #[test]
    fn test_session_with_full_weather() {
        let session = ObservationSession {
            id: "full".to_string(),
            date: NaiveDate::from_ymd_opt(2024, 7, 1).unwrap(),
            location_id: Some("loc".to_string()),
            location_name: Some("Observatory".to_string()),
            start_time: Some(Utc::now()),
            end_time: Some(Utc::now()),
            weather: Some(WeatherConditions {
                temperature: Some(18.0),
                humidity: Some(55.0),
                wind_speed: Some(5.0),
                cloud_cover: Some(0),
                moon_phase: Some(0.1),
                moon_illumination: Some(10.0),
            }),
            seeing: Some(5),
            transparency: Some(5),
            equipment_ids: vec!["t1".to_string(), "c1".to_string()],
            bortle_class: Some(2),
            notes: Some("Perfect conditions".to_string()),
            observations: vec![],
            source_plan_id: None,
            source_plan_name: None,
            execution_status: None,
            execution_targets: None,
            weather_snapshot: None,
            execution_summary: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&session).unwrap();
        let back: ObservationSession = serde_json::from_str(&json).unwrap();
        assert!(back.weather.is_some());
        assert_eq!(back.weather.unwrap().temperature, Some(18.0));
    }

    #[test]
    fn test_observation_with_multiple_images() {
        let obs = Observation {
            id: "multi-img".to_string(),
            object_name: "M42".to_string(),
            object_type: Some("Nebula".to_string()),
            ra: Some(83.82),
            dec: Some(-5.39),
            constellation: Some("Orion".to_string()),
            observed_at: Utc::now(),
            telescope_id: None,
            eyepiece_id: None,
            camera_id: None,
            filter_id: None,
            magnification: None,
            rating: None,
            difficulty: None,
            notes: None,
            sketch_path: Some("/sketches/m42.png".to_string()),
            image_paths: vec![
                "img1.fits".to_string(),
                "img2.fits".to_string(),
                "img3.fits".to_string(),
            ],
            execution_target_id: None,
        };

        let json = serde_json::to_string(&obs).unwrap();
        let back: Observation = serde_json::from_str(&json).unwrap();
        assert_eq!(back.image_paths.len(), 3);
        assert!(back.sketch_path.is_some());
    }

    #[test]
    fn test_session_with_observations() {
        let session = ObservationSession {
            id: "with-obs".to_string(),
            date: NaiveDate::from_ymd_opt(2024, 8, 1).unwrap(),
            location_id: None,
            location_name: None,
            start_time: None,
            end_time: None,
            weather: None,
            seeing: None,
            transparency: None,
            equipment_ids: vec![],
            bortle_class: None,
            notes: None,
            observations: vec![
                Observation {
                    id: "o1".to_string(),
                    object_name: "M31".to_string(),
                    object_type: None,
                    ra: None,
                    dec: None,
                    constellation: None,
                    observed_at: Utc::now(),
                    telescope_id: None,
                    eyepiece_id: None,
                    camera_id: None,
                    filter_id: None,
                    magnification: None,
                    rating: None,
                    difficulty: None,
                    notes: None,
                    sketch_path: None,
                    image_paths: vec![],
                    execution_target_id: None,
                },
                Observation {
                    id: "o2".to_string(),
                    object_name: "M42".to_string(),
                    object_type: None,
                    ra: None,
                    dec: None,
                    constellation: None,
                    observed_at: Utc::now(),
                    telescope_id: None,
                    eyepiece_id: None,
                    camera_id: None,
                    filter_id: None,
                    magnification: None,
                    rating: None,
                    difficulty: None,
                    notes: None,
                    sketch_path: None,
                    image_paths: vec![],
                    execution_target_id: None,
                },
            ],
            source_plan_id: None,
            source_plan_name: None,
            execution_status: None,
            execution_targets: None,
            weather_snapshot: None,
            execution_summary: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&session).unwrap();
        let back: ObservationSession = serde_json::from_str(&json).unwrap();
        assert_eq!(back.observations.len(), 2);
    }
}
