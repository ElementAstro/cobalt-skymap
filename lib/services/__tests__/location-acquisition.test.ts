/**
 * @jest-environment jsdom
 */

import { acquireCurrentLocation } from '../location-acquisition';

const mockIsAvailable = jest.fn();
const mockCheckPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockGetCurrentPosition = jest.fn();

jest.mock('@/lib/tauri/geolocation-api', () => ({
  geolocationApi: {
    isAvailable: () => mockIsAvailable(),
    checkPermissions: (...args: unknown[]) => mockCheckPermissions(...args),
    requestPermissions: (...args: unknown[]) => mockRequestPermissions(...args),
    getCurrentPosition: (...args: unknown[]) => mockGetCurrentPosition(...args),
  },
}));

describe('acquireCurrentLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAvailable.mockReturnValue(false);
  });

  it('uses Tauri mobile geolocation when available and permission is granted', async () => {
    mockIsAvailable.mockReturnValue(true);
    mockCheckPermissions.mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
    mockGetCurrentPosition.mockResolvedValue({
      coords: {
        latitude: 12.34,
        longitude: 56.78,
        altitude: 100,
        accuracy: 5,
      },
      timestamp: 123456,
    });

    const result = await acquireCurrentLocation();

    expect(mockCheckPermissions).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'success',
      source: 'tauri-mobile',
      location: {
        latitude: 12.34,
        longitude: 56.78,
        altitude: 100,
        accuracy: 5,
        timestamp: 123456,
      },
    });
  });

  it('uses browser geolocation when Tauri mobile geolocation is unavailable', async () => {
    const getCurrentPosition = jest.fn().mockImplementation((success: (position: GeolocationPosition) => void) => {
      success({
        coords: {
          latitude: 40.1,
          longitude: -74.2,
          altitude: null,
          accuracy: 10,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: 654321,
        toJSON: () => ({}),
      } as GeolocationPosition);
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
      writable: true,
    });

    const result = await acquireCurrentLocation();

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'success',
      source: 'browser',
      location: {
        latitude: 40.1,
        longitude: -74.2,
        altitude: null,
        accuracy: 10,
        timestamp: 654321,
      },
    });
  });

  it('returns permission_denied when Tauri permissions are denied', async () => {
    mockIsAvailable.mockReturnValue(true);
    mockCheckPermissions.mockResolvedValue({ location: 'prompt', coarseLocation: 'prompt' });
    mockRequestPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });

    const result = await acquireCurrentLocation();

    expect(result).toEqual({
      status: 'permission_denied',
      source: 'tauri-mobile',
      message: 'Location permission denied',
    });
  });

  it('returns timeout when browser geolocation times out', async () => {
    const getCurrentPosition = jest.fn().mockImplementation(
      (_success: unknown, error: (err: { code: number; message: string }) => void) => {
        error({ code: 3, message: 'Timed out' });
      }
    );

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
      writable: true,
    });

    const result = await acquireCurrentLocation();

    expect(result).toEqual({
      status: 'timeout',
      source: 'browser',
      message: 'Timed out',
    });
  });

  it('returns unavailable when browser geolocation is not supported', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const result = await acquireCurrentLocation();

    expect(result).toEqual({
      status: 'unavailable',
      source: 'browser',
      message: 'Geolocation is not available',
    });
  });
});
