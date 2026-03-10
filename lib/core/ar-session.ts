export type ARSessionStatus =
  | 'idle'
  | 'preflight'
  | 'ready'
  | 'degraded-camera-only'
  | 'degraded-sensor-only'
  | 'blocked';

export type ARRecoveryAction =
  | 'retry-camera'
  | 'request-sensor-permission'
  | 'calibrate-sensor'
  | 'disable-ar';

export type ARCameraErrorType =
  | 'not-supported'
  | 'not-found'
  | 'permission-denied'
  | 'in-use'
  | 'unknown'
  | null;

export type ARSensorStatus =
  | 'idle'
  | 'unsupported'
  | 'permission-required'
  | 'permission-denied'
  | 'calibration-required'
  | 'degraded'
  | 'active'
  | 'error';

export type ARSensorDegradedReason =
  | 'relative-source'
  | 'low-confidence'
  | 'stale-sample'
  | null;

export interface ARCameraRuntimeState {
  isSupported: boolean;
  isLoading: boolean;
  hasStream: boolean;
  errorType: ARCameraErrorType;
}

export interface ARSensorRuntimeState {
  isSupported: boolean;
  isPermissionGranted: boolean;
  status: ARSensorStatus;
  calibrationRequired: boolean;
  degradedReason: ARSensorDegradedReason;
  source: 'deviceorientationabsolute' | 'deviceorientation' | 'webkitCompassHeading' | 'none';
  accuracyDeg: number | null;
  error: string | null;
}

export interface ARSessionInput {
  enabled: boolean;
  showCompassPreference: boolean;
  camera: ARCameraRuntimeState;
  sensor: ARSensorRuntimeState;
}

export interface ARSessionDerivedState {
  status: ARSessionStatus;
  cameraLayerEnabled: boolean;
  sensorPointingEnabled: boolean;
  compassEnabled: boolean;
  needsUserAction: boolean;
  recoveryActions: ARRecoveryAction[];
}

export const DEFAULT_AR_CAMERA_RUNTIME_STATE: ARCameraRuntimeState = {
  isSupported: true,
  isLoading: false,
  hasStream: false,
  errorType: null,
};

export const DEFAULT_AR_SENSOR_RUNTIME_STATE: ARSensorRuntimeState = {
  isSupported: true,
  isPermissionGranted: false,
  status: 'idle',
  calibrationRequired: true,
  degradedReason: null,
  source: 'none',
  accuracyDeg: null,
  error: null,
};

function uniqueActions(actions: ARRecoveryAction[]): ARRecoveryAction[] {
  return Array.from(new Set(actions));
}

export function deriveARSessionState(input: ARSessionInput): ARSessionDerivedState {
  if (!input.enabled) {
    return {
      status: 'idle',
      cameraLayerEnabled: false,
      sensorPointingEnabled: false,
      compassEnabled: false,
      needsUserAction: false,
      recoveryActions: [],
    };
  }

  const { camera, sensor, showCompassPreference } = input;

  const cameraOperational = camera.isSupported && camera.hasStream && !camera.errorType;
  const sensorPermissionBlocked =
    sensor.status === 'permission-denied' ||
    sensor.status === 'permission-required' ||
    (!sensor.isPermissionGranted && sensor.status !== 'unsupported');
  const sensorCalibrationBlocked =
    sensor.calibrationRequired || sensor.status === 'calibration-required';
  const sensorDegraded = sensor.status === 'degraded';
  const sensorOperational =
    sensor.isSupported &&
    sensor.isPermissionGranted &&
    sensor.status === 'active' &&
    !sensorCalibrationBlocked;

  const preflightPending =
    camera.isLoading ||
    sensor.status === 'permission-required' ||
    sensor.status === 'idle';

  let status: ARSessionStatus;
  if (cameraOperational && sensorOperational) {
    status = 'ready';
  } else if (preflightPending) {
    status = 'preflight';
  } else if (cameraOperational && !sensorOperational) {
    status = 'degraded-camera-only';
  } else if (!cameraOperational && sensorOperational) {
    status = 'degraded-sensor-only';
  } else {
    status = 'blocked';
  }

  const recoveryActions: ARRecoveryAction[] = [];
  if (!cameraOperational && !camera.isLoading && camera.errorType !== 'not-supported') {
    recoveryActions.push('retry-camera');
  }
  if (sensorPermissionBlocked) {
    recoveryActions.push('request-sensor-permission');
  }
  if ((sensorCalibrationBlocked || sensorDegraded) && sensor.isPermissionGranted && sensor.isSupported) {
    recoveryActions.push('calibrate-sensor');
  }
  if (status !== 'ready') {
    recoveryActions.push('disable-ar');
  }

  const cameraLayerEnabled = cameraOperational;
  const sensorPointingEnabled = sensorOperational;
  const compassEnabled = showCompassPreference && sensorOperational;

  return {
    status,
    cameraLayerEnabled,
    sensorPointingEnabled,
    compassEnabled,
    needsUserAction: status !== 'ready',
    recoveryActions: uniqueActions(recoveryActions),
  };
}
