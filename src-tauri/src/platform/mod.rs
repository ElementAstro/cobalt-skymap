//! Platform module
//! Desktop-specific functionality for the Tauri application
//!
//! Submodules:
//! - `app_settings`: Application settings, window state, and preferences
//! - `app_control`: Application lifecycle control (restart, quit, reload)
//! - `updater`: Application update checking and installation
//! - `plate_solver`: Astronomical plate solving integration

pub mod app_settings;
pub mod app_control;
pub mod updater;
pub mod plate_solver;
pub mod path_config;
pub mod map_keys;

// Re-export app settings types and commands
pub use app_settings::{
    AppSettings, RecentFile, SystemInfo, WindowState,
    add_recent_file, clear_recent_files, get_system_info, load_app_settings,
    open_path, restore_window_state, reveal_in_file_manager, save_app_settings, save_window_state,
};

// Re-export app control commands
pub use app_control::{
    is_dev_mode, quit_app, reload_webview, restart_app,
};

// Re-export updater types and commands
pub use updater::{
    UpdateInfo, UpdateProgress, UpdateStatus, UpdaterError,
    check_for_update, clear_pending_update, download_and_install_update, download_update,
    get_current_version, has_pending_update, install_update,
};

// Re-export path config types and commands
pub use path_config::{
    DirectoryValidation, MigrationResult, PathConfig, PathInfo,
    get_path_config, migrate_cache_dir, migrate_data_dir, reset_paths_to_default,
    set_custom_cache_dir, set_custom_data_dir, validate_directory,
};

// Re-export secure map key types and commands
pub use map_keys::{
    MapApiKeyMeta, MapApiKeyQuota, MapApiKeyRecord, MapApiKeyRestrictions,
    delete_map_api_key, get_map_api_key, list_map_api_keys_meta, save_map_api_key,
    set_active_map_api_key,
};

// Re-export plate solver types and commands
pub use plate_solver::{
    // Types
    AstapDatabaseInfo, AstrometryIndex, DownloadableIndex, DownloadableIndexFull,
    ImageAnalysisResult, IndexDownloadProgress, IndexInfo, OnlineAnnotation,
    OnlineSolveConfig, OnlineSolveProgress, OnlineSolveResult,
    PlateSolveResult, PlateSolverConfig, PlateSolverError, PlateSolverType, ScaleRange,
    SipCoefficients, SolveParameters, SolveResult, SolverConfig, SolverInfo,
    StarDetection, WcsResult,
    // Commands
    analyse_image, delete_index, detect_plate_solvers, download_index, extract_stars,
    get_astap_databases, get_available_indexes, get_default_index_path,
    get_downloadable_indexes, get_installed_indexes, get_recommended_indexes,
    cancel_online_solve, cancel_plate_solve, get_solver_indexes, get_solver_info, load_solver_config, plate_solve,
    recommend_astap_database, save_solver_config, solve_image_local, solve_online,
    validate_solver_path,
};
