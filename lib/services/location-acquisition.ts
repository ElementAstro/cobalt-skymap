/**
 * Shared current-location acquisition flow for web and Tauri mobile.
 */

import { createLogger } from '@/lib/logger';
import { geolocationApi, type PositionOptions } from '@/lib/tauri/geolocation-api';

const logger = createLogger('location-acquisition');

const GEO_PERMISSION_DENIED = 1;
const GEO_POSITION_UNAVAILABLE = 2;
const GEO_TIMEOUT = 3;

export type LocationAcquisitionStatus =
  | 'success'
  | 'permission_denied'
  | 'unavailable'
  | 'timeout'
  | 'failed';

export type LocationAcquisitionSource = 'tauri-mobile' | 'browser';

export interface AcquiredLocation {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  timestamp: number;
}

export interface LocationAcquisitionSuccess {
  status: 'success';
  source: LocationAcquisitionSource;
  location: AcquiredLocation;
}

export interface LocationAcquisitionFailure {
  status: Exclude<LocationAcquisitionStatus, 'success'>;
  source: LocationAcquisitionSource;
  message: string;
}

export type LocationAcquisitionResult =
  | LocationAcquisitionSuccess
  | LocationAcquisitionFailure;

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

function toFailure(
  status: Exclude<LocationAcquisitionStatus, 'success'>,
  source: LocationAcquisitionSource,
  message: string
): LocationAcquisitionFailure {
  return { status, source, message };
}

function normalizeMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) return error;
  if (
    typeof error === 'object'
    && error !== null
    && 'message' in error
    && typeof (error as { message?: unknown }).message === 'string'
    && (error as { message: string }).message.trim()
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

function extractErrorCode(error: unknown): number | null {
  if (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && typeof (error as { code?: unknown }).code === 'number'
  ) {
    return (error as { code: number }).code;
  }
  return null;
}

function classifyError(
  error: unknown,
  source: LocationAcquisitionSource
): LocationAcquisitionFailure {
  const code = extractErrorCode(error);
  if (code === GEO_PERMISSION_DENIED) {
    return toFailure('permission_denied', source, normalizeMessage(error, 'Location permission denied'));
  }
  if (code === GEO_POSITION_UNAVAILABLE) {
    return toFailure('unavailable', source, normalizeMessage(error, 'Location information unavailable'));
  }
  if (code === GEO_TIMEOUT) {
    return toFailure('timeout', source, normalizeMessage(error, 'Location request timed out'));
  }

  const message = normalizeMessage(error, 'Failed to get current location');
  const lower = message.toLowerCase();
  if (lower.includes('denied') || lower.includes('permission')) {
    return toFailure('permission_denied', source, message);
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return toFailure('timeout', source, message);
  }
  if (lower.includes('unavailable') || lower.includes('not available') || lower.includes('unsupported')) {
    return toFailure('unavailable', source, message);
  }
  return toFailure('failed', source, message);
}

async function acquireFromTauri(
  options: PositionOptions
): Promise<LocationAcquisitionResult> {
  try {
    let permissions = await geolocationApi.checkPermissions();

    if (permissions.location === 'prompt' || permissions.location === 'prompt-with-rationale') {
      permissions = await geolocationApi.requestPermissions(['location']);
    }

    if (permissions.location !== 'granted') {
      return toFailure('permission_denied', 'tauri-mobile', 'Location permission denied');
    }

    const position = await geolocationApi.getCurrentPosition(options);

    return {
      status: 'success',
      source: 'tauri-mobile',
      location: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      },
    };
  } catch (error) {
    logger.warn('Failed to acquire location via Tauri mobile geolocation', error);
    return classifyError(error, 'tauri-mobile');
  }
}

async function acquireFromBrowser(
  options: PositionOptions
): Promise<LocationAcquisitionResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return toFailure('unavailable', 'browser', 'Geolocation is not available');
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

    return {
      status: 'success',
      source: 'browser',
      location: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      },
    };
  } catch (error) {
    logger.warn('Failed to acquire location via browser geolocation', error);
    return classifyError(error, 'browser');
  }
}

export async function acquireCurrentLocation(
  options: Partial<PositionOptions> = {}
): Promise<LocationAcquisitionResult> {
  const mergedOptions: PositionOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (geolocationApi.isAvailable()) {
    return acquireFromTauri(mergedOptions);
  }

  return acquireFromBrowser(mergedOptions);
}
