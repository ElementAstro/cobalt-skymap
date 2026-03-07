/**
 * TypeScript types for Tauri Rust backend commands
 */

// ============================================================================
// Equipment Types
// ============================================================================

export type TelescopeType = 'refractor' | 'reflector' | 'catadioptric' | 'other';

export interface Telescope {
  id: string;
  name: string;
  aperture: number;       // mm
  focal_length: number;   // mm
  focal_ratio: number;
  telescope_type: TelescopeType;
  mount_type?: string;
  notes?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type CameraType = 'cmos' | 'ccd' | 'dslr' | 'mirrorless' | 'webcam' | 'other';

export interface Camera {
  id: string;
  name: string;
  sensor_width: number;   // mm
  sensor_height: number;  // mm
  pixel_size: number;     // μm
  resolution_x: number;   // pixels
  resolution_y: number;   // pixels
  camera_type: CameraType;
  has_cooler: boolean;
  notes?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Eyepiece {
  id: string;
  name: string;
  focal_length: number;   // mm
  apparent_fov: number;   // degrees
  barrel_size: number;    // inches
  eye_relief?: number;    // mm
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BarlowReducer {
  id: string;
  name: string;
  factor: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type FilterType = 
  | 'luminance' | 'red' | 'green' | 'blue'
  | 'ha' | 'oiii' | 'sii'
  | 'uhc_lps' | 'cls' | 'other';

export interface Filter {
  id: string;
  name: string;
  filter_type: FilterType;
  bandwidth?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface EquipmentData {
  telescopes: Telescope[];
  cameras: Camera[];
  eyepieces: Eyepiece[];
  barlow_reducers: BarlowReducer[];
  filters: Filter[];
}

// ============================================================================
// Location Types
// ============================================================================

export interface ObservationLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
  timezone?: string;
  bortle_class?: number;  // 1-9
  notes?: string;
  is_default: boolean;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationsData {
  locations: ObservationLocation[];
  current_location_id?: string;
}

// ============================================================================
// Observation Log Types
// ============================================================================

export interface WeatherConditions {
  temperature?: number;
  humidity?: number;
  wind_speed?: number;
  cloud_cover?: number;
  moon_phase?: number;
  moon_illumination?: number;
}

export interface Observation {
  id: string;
  object_name: string;
  object_type?: string;
  ra?: number;
  dec?: number;
  constellation?: string;
  observed_at: string;
  telescope_id?: string;
  eyepiece_id?: string;
  camera_id?: string;
  filter_id?: string;
  magnification?: number;
  rating?: number;        // 1-5
  difficulty?: number;    // 1-5
  notes?: string;
  sketch_path?: string;
  image_paths: string[];
  execution_target_id?: string;
}

export type ObservationExecutionStatus =
  | 'draft'
  | 'ready'
  | 'active'
  | 'completed'
  | 'archived'
  | 'cancelled';

export type ObservationExecutionTargetStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'failed';

export interface ObservationExecutionTarget {
  id: string;
  target_id: string;
  target_name: string;
  scheduled_start: string;
  scheduled_end: string;
  scheduled_duration_minutes: number;
  order: number;
  status: ObservationExecutionTargetStatus;
  observation_ids: string[];
  actual_start?: string;
  actual_end?: string;
  result_notes?: string;
  skip_reason?: string;
  completion_summary?: string;
  unplanned?: boolean;
}

export interface ObservationExecutionSummary {
  completed_targets: number;
  skipped_targets: number;
  failed_targets: number;
  total_targets: number;
  total_observations: number;
}

export interface CreatePlannedSessionTarget {
  id: string;
  targetId: string;
  targetName: string;
  scheduledStart: string;
  scheduledEnd: string;
  scheduledDurationMinutes: number;
  order: number;
  status: ObservationExecutionTargetStatus;
  observationIds: string[];
  actualStart?: string;
  actualEnd?: string;
  resultNotes?: string;
  skipReason?: string;
  completionSummary?: string;
  unplanned?: boolean;
}

export interface CreatePlannedSessionPayload {
  planDate: string;
  locationId?: string;
  locationName?: string;
  sourcePlanId: string;
  sourcePlanName: string;
  notes?: string;
  weatherSnapshot?: unknown;
  executionTargets: CreatePlannedSessionTarget[];
}

export interface ObservationSession {
  id: string;
  date: string;
  location_id?: string;
  location_name?: string;
  start_time?: string;
  end_time?: string;
  weather?: WeatherConditions;
  seeing?: number;        // 1-5
  transparency?: number;  // 1-5
  equipment_ids: string[];
  bortle_class?: number;   // 1-9
  notes?: string;
  observations: Observation[];
  source_plan_id?: string;
  source_plan_name?: string;
  execution_status?: ObservationExecutionStatus;
  execution_targets?: ObservationExecutionTarget[];
  weather_snapshot?: unknown;
  execution_summary?: ObservationExecutionSummary;
  created_at: string;
  updated_at: string;
}

export interface ObservationLogData {
  sessions: ObservationSession[];
}

export interface ObservationStats {
  total_sessions: number;
  total_observations: number;
  unique_objects: number;
  total_hours: number;
  objects_by_type: [string, number][];
  monthly_counts: [string, number][];
}

// ============================================================================
// Target Import/Export Types
// ============================================================================

export interface TargetExportItem {
  name: string;
  ra: number;
  dec: number;
  ra_string: string;
  dec_string: string;
  object_type?: string;
  constellation?: string;
  magnitude?: number;
  size?: string;
  notes?: string;
  priority?: string;
  tags?: string;
}

export interface ImportTargetsResult {
  imported: number;
  skipped: number;
  errors: string[];
  targets: TargetExportItem[];
}

export type ExportFormat = 'csv' | 'json' | 'stellarium' | 'mosaic';

export interface SessionTemplateEntry {
  id: string;
  name: string;
  draft: unknown;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// App Settings Types
// ============================================================================

export interface WindowState {
  width: number;
  height: number;
  x: number;
  y: number;
  maximized: boolean;
  fullscreen: boolean;
}

export interface RecentFile {
  path: string;
  name: string;
  file_type: string;
  accessed_at: number;
}

export interface AppSettings {
  window_state: WindowState;
  recent_files: RecentFile[];
  last_export_dir?: string;
  last_import_dir?: string;
  auto_save_interval: number;
  check_updates: boolean;
  telemetry_enabled: boolean;
  theme: string;
  sidebar_collapsed: boolean;
  show_welcome: boolean;
  language: string;
}

export interface SystemInfo {
  os: string;
  arch: string;
  app_version: string;
  tauri_version: string;
}

// ============================================================================
// Storage Types
// ============================================================================

export interface StorageStats {
  total_size: number;
  store_count: number;
  stores: StoreInfo[];
  directory: string;
}

// ============================================================================
// Secure Map API Key Types
// ============================================================================

export interface MapApiKeyQuota {
  daily?: number;
  monthly?: number;
  used?: number;
  resetDate?: string;
}

export interface MapApiKeyRestrictions {
  domains?: string[];
  ips?: string[];
  regions?: string[];
}

export interface MapApiKeyMeta {
  id: string;
  provider: 'openstreetmap' | 'google' | 'mapbox';
  label?: string;
  isDefault?: boolean;
  isActive?: boolean;
  quota?: MapApiKeyQuota;
  restrictions?: MapApiKeyRestrictions;
  createdAt: string;
  lastUsed?: string;
}

export interface SecureKeyMigrationResult {
  migrated: number;
  skipped: number;
  failed: number;
  message?: string;
}

export interface StoreInfo {
  name: string;
  size: number;
  modified?: string;
}

export interface ExportMetadata {
  version: string;
  exported_at: string;
  app_version: string;
  store_count: number;
}

export interface ImportResult {
  imported_count: number;
  skipped_count: number;
  errors: string[];
  metadata: ExportMetadata;
}
