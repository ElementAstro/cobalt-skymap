//! Plate solving module
//! Integrates with ASTAP and Astrometry.net for astronomical plate solving

pub mod types;
pub mod fits;
pub mod astap;
pub mod astrometry;
pub mod online;
pub mod index;
pub mod config;
pub mod helpers;

use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;

use tauri::{AppHandle, Emitter};

use types::SolveProgressEvent;

static ACTIVE_SOLVE_PID: Mutex<Option<u32>> = Mutex::new(None);

#[tauri::command]
pub async fn detect_plate_solvers() -> Result<Vec<SolverInfo>, PlateSolverError> {
    let mut solvers = Vec::new();

    // Check for ASTAP
    let astap_paths = astap::get_astap_paths();
    for path in astap_paths {
        if PathBuf::from(&path).exists() {
            let version = astap::get_astap_version(&path);
            solvers.push(SolverInfo {
                solver_type: PlateSolverType::Astap,
                name: "ASTAP".to_string(),
                version,
                path: path.clone(),
                available: true,
                index_path: astap::get_astap_index_path(&path),
            });
            break;
        }
    }

    // Check for local Astrometry.net
    let astrometry_paths = astrometry::get_astrometry_paths();
    for path in astrometry_paths {
        if PathBuf::from(&path).exists() {
            let version = astrometry::get_astrometry_version(&path);
            solvers.push(SolverInfo {
                solver_type: PlateSolverType::LocalAstrometry,
                name: "Astrometry.net (local)".to_string(),
                version,
                path: path.clone(),
                available: true,
                index_path: astrometry::get_astrometry_index_path(),
            });
            break;
        }
    }

    // Always add online Astrometry.net as fallback
    solvers.push(SolverInfo {
        solver_type: PlateSolverType::AstrometryNet,
        name: "Astrometry.net (online)".to_string(),
        version: None,
        path: "https://nova.astrometry.net".to_string(),
        available: true,
        index_path: None,
    });

    Ok(solvers)
}

#[tauri::command]
pub async fn cancel_plate_solve() -> Result<(), PlateSolverError> {
    let pid = {
        let mut guard = ACTIVE_SOLVE_PID.lock().unwrap();
        guard.take()
    };
    if let Some(pid) = pid {
        log::info!("Cancelling plate solve process with PID {}", pid);
        #[cfg(target_os = "windows")]
        {
            let _ = Command::new("taskkill")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .output();
        }
        #[cfg(not(target_os = "windows"))]
        {
            unsafe { libc::kill(pid as i32, libc::SIGTERM); }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn plate_solve(_app: AppHandle, config: PlateSolverConfig) -> Result<PlateSolveResult, PlateSolverError> {
    let start = std::time::Instant::now();

    // Verify image exists
    if !PathBuf::from(&config.image_path).exists() {
        return Err(PlateSolverError::InvalidImage(format!("Image not found: {}", config.image_path)));
    }

    let result = match config.solver_type {
        PlateSolverType::Astap => astap::solve_with_astap(&config).await,
        PlateSolverType::LocalAstrometry => astrometry::solve_with_local_astrometry(&config).await,
        PlateSolverType::AstrometryNet => online::solve_with_online_astrometry(&config).await,
    };

    match result {
        Ok(mut r) => {
            r.solve_time_ms = start.elapsed().as_millis() as u64;
            Ok(r)
        }
        Err(e) => Ok(PlateSolveResult {
            success: false, ra: None, dec: None, rotation: None, scale: None,
            width_deg: None, height_deg: None, flipped: None,
            error_message: Some(e.to_string()),
            solve_time_ms: start.elapsed().as_millis() as u64,
        }),
    }
}

#[tauri::command]
pub async fn solve_image_local(app: AppHandle, config: SolverConfig, params: types::SolveParameters) -> Result<SolveResult, PlateSolverError> {
    let start = std::time::Instant::now();
    
    if !PathBuf::from(&params.image_path).exists() {
        return Err(PlateSolverError::InvalidImage(format!("Image not found: {}", params.image_path)));
    }

    // Emit: preparing
    let _ = app.emit("solve-progress", SolveProgressEvent {
        stage: "preparing".to_string(),
        progress: 5.0,
        message: "Validating image and building solver arguments...".to_string(),
    });

    let solver_config = PlateSolverConfig {
        solver_type: match config.solver_type.as_str() {
            "astap" => PlateSolverType::Astap,
            "astrometry_net" => PlateSolverType::LocalAstrometry,
            _ => PlateSolverType::AstrometryNet,
        },
        image_path: params.image_path.clone(),
        ra_hint: params.ra_hint,
        dec_hint: params.dec_hint,
        radius_hint: params.search_radius,
        scale_low: config.astrometry_scale_low,
        scale_high: config.astrometry_scale_high,
        downsample: Some(config.downsample),
        timeout_seconds: Some(config.timeout_seconds),
    };

    // Emit: solving
    let _ = app.emit("solve-progress", SolveProgressEvent {
        stage: "solving".to_string(),
        progress: 15.0,
        message: "Running plate solver...".to_string(),
    });

    let result = match solver_config.solver_type {
        PlateSolverType::Astap => astap::solve_with_astap_enhanced(&solver_config, Some(&config)).await,
        PlateSolverType::LocalAstrometry => astrometry::solve_with_local_astrometry(&solver_config).await,
        PlateSolverType::AstrometryNet => online::solve_with_online_astrometry(&solver_config).await,
    };

    // Emit: parsing results
    let _ = app.emit("solve-progress", SolveProgressEvent {
        stage: "parsing".to_string(),
        progress: 85.0,
        message: "Parsing solve results...".to_string(),
    });

    let solve_time_ms = start.elapsed().as_millis() as u64;

    // Check for WCS file to return path
    let wcs_file_path = PathBuf::from(&params.image_path).with_extension("wcs");
    let wcs_file = if wcs_file_path.exists() {
        Some(wcs_file_path.to_string_lossy().to_string())
    } else {
        None
    };

    match result {
        Ok(r) => Ok(SolveResult {
            success: r.success,
            ra: r.ra,
            dec: r.dec,
            ra_hms: r.ra.map(helpers::format_ra_hms),
            dec_dms: r.dec.map(helpers::format_dec_dms),
            position_angle: r.rotation,
            pixel_scale: r.scale,
            fov_width: r.width_deg,
            fov_height: r.height_deg,
            flipped: r.flipped,
            solver_name: config.solver_type.clone(),
            solve_time_ms,
            error_message: r.error_message,
            wcs_file,
        }),
        Err(e) => Ok(SolveResult {
            success: false,
            ra: None, dec: None, ra_hms: None, dec_dms: None,
            position_angle: None, pixel_scale: None, fov_width: None, fov_height: None,
            flipped: None,
            solver_name: config.solver_type,
            solve_time_ms,
            error_message: Some(e.to_string()),
            wcs_file: None,
        }),
    }
}

// Re-export all public types
pub use types::{
    AstapDatabaseInfo, AstrometryIndex, DownloadableIndex, DownloadableIndexFull,
    ImageAnalysisResult, IndexDownloadProgress, IndexInfo, OnlineAnnotation,
    OnlineSolveConfig, OnlineSolveProgress, OnlineSolveResult,
    PlateSolveResult, PlateSolverConfig, PlateSolverError, PlateSolverType,
    ScaleRange, SipCoefficients, SolveParameters, SolveResult,
    SolverConfig, SolverInfo,
    StarDetection, WcsResult,
};

// Re-export commands from submodules
pub use astap::{analyse_image, extract_stars, get_astap_databases, recommend_astap_database};
pub use config::{load_solver_config, save_solver_config};
pub use helpers::{get_default_index_path, get_solver_info, validate_solver_path};
pub use index::{
    delete_index, download_index, get_available_indexes, get_downloadable_indexes,
    get_installed_indexes, get_recommended_indexes, get_solver_indexes,
};
pub use online::{cancel_online_solve, solve_online};
