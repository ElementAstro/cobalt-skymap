import {
  deriveARSessionState,
  type ARSessionInput,
} from '../ar-session';

function buildInput(overrides: Partial<ARSessionInput> = {}): ARSessionInput {
  return {
    enabled: true,
    showCompassPreference: true,
    camera: {
      isSupported: true,
      isLoading: false,
      hasStream: true,
      errorType: null,
    },
    sensor: {
      isSupported: true,
      isPermissionGranted: true,
      status: 'active',
      calibrationRequired: false,
      degradedReason: null,
      source: 'none',
      accuracyDeg: null,
      error: null,
    },
    ...overrides,
  };
}

describe('deriveARSessionState', () => {
  it('returns idle state when AR is disabled', () => {
    const result = deriveARSessionState(buildInput({ enabled: false }));
    expect(result.status).toBe('idle');
    expect(result.cameraLayerEnabled).toBe(false);
    expect(result.sensorPointingEnabled).toBe(false);
    expect(result.compassEnabled).toBe(false);
    expect(result.needsUserAction).toBe(false);
  });

  it('returns ready when camera and sensor are operational', () => {
    const result = deriveARSessionState(buildInput());
    expect(result.status).toBe('ready');
    expect(result.cameraLayerEnabled).toBe(true);
    expect(result.sensorPointingEnabled).toBe(true);
    expect(result.compassEnabled).toBe(true);
    expect(result.needsUserAction).toBe(false);
  });

  it('returns preflight while camera is loading', () => {
    const result = deriveARSessionState(
      buildInput({
        camera: {
          isSupported: true,
          isLoading: true,
          hasStream: false,
          errorType: null,
        },
      })
    );

    expect(result.status).toBe('preflight');
    expect(result.needsUserAction).toBe(true);
  });

  it('returns degraded-camera-only when camera is operational but sensor needs calibration', () => {
    const result = deriveARSessionState(
      buildInput({
        sensor: {
          isSupported: true,
          isPermissionGranted: true,
          status: 'calibration-required',
          calibrationRequired: true,
          degradedReason: null,
          source: 'none',
          accuracyDeg: null,
          error: null,
        },
      })
    );

    expect(result.status).toBe('degraded-camera-only');
    expect(result.cameraLayerEnabled).toBe(true);
    expect(result.sensorPointingEnabled).toBe(false);
    expect(result.recoveryActions).toContain('calibrate-sensor');
  });

  it('treats degraded sensor confidence as camera-only degraded state', () => {
    const result = deriveARSessionState(
      buildInput({
        sensor: {
          isSupported: true,
          isPermissionGranted: true,
          status: 'degraded',
          calibrationRequired: false,
          degradedReason: 'low-confidence',
          source: 'webkitCompassHeading',
          accuracyDeg: 24,
          error: null,
        },
      })
    );

    expect(result.status).toBe('degraded-camera-only');
    expect(result.recoveryActions).toContain('calibrate-sensor');
  });

  it('returns degraded-sensor-only when sensor is operational but camera failed', () => {
    const result = deriveARSessionState(
      buildInput({
        camera: {
          isSupported: true,
          isLoading: false,
          hasStream: false,
          errorType: 'in-use',
        },
      })
    );

    expect(result.status).toBe('degraded-sensor-only');
    expect(result.cameraLayerEnabled).toBe(false);
    expect(result.sensorPointingEnabled).toBe(true);
    expect(result.recoveryActions).toContain('retry-camera');
  });

  it('returns blocked when camera and sensor are both unusable', () => {
    const result = deriveARSessionState(
      buildInput({
        camera: {
          isSupported: false,
          isLoading: false,
          hasStream: false,
          errorType: 'not-supported',
        },
        sensor: {
          isSupported: false,
          isPermissionGranted: false,
          status: 'unsupported',
          calibrationRequired: true,
          degradedReason: null,
          source: 'none',
          accuracyDeg: null,
          error: null,
        },
      })
    );

    expect(result.status).toBe('blocked');
    expect(result.recoveryActions).toContain('disable-ar');
  });

  it('disables compass when preference is off', () => {
    const result = deriveARSessionState(
      buildInput({
        showCompassPreference: false,
      })
    );

    expect(result.status).toBe('ready');
    expect(result.compassEnabled).toBe(false);
  });
});
