/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';

// Mock unified cache
jest.mock('@/lib/offline', () => ({
  unifiedCache: {
    fetch: jest.fn().mockResolvedValue({ ok: true }),
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

// Mock translations
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/lib/translations', () => ({
  createStellariumTranslator: jest.fn(() => (domain: string, text: string) => text),
}));

// Mock stores
const mockSetStel = jest.fn();
const mockSetBaseUrl = jest.fn();
const mockSetHelpers = jest.fn();
const mockUpdateStellariumCore = jest.fn();
const mockSetProfileInfo = jest.fn();

jest.mock('@/lib/stores', () => ({
  useStellariumStore: jest.fn((selector) => {
    const state = {
      setStel: mockSetStel,
      setBaseUrl: mockSetBaseUrl,
      setHelpers: mockSetHelpers,
      updateStellariumCore: mockUpdateStellariumCore,
    };
    return selector(state);
  }),
  useSettingsStore: Object.assign(
    jest.fn((selector) => {
      const state = {
        stellarium: {
          constellationsLinesVisible: true,
          skyCultureLanguage: 'native',
        },
      };
      return selector(state);
    }),
    {
      getState: () => ({
        stellarium: {
          skyCultureLanguage: 'native',
        },
      }),
    }
  ),
  useMountStore: Object.assign(
    jest.fn((selector) => {
      const state = {
        profileInfo: {
          AstrometrySettings: {
            Latitude: 51.5,
            Longitude: -0.1,
            Elevation: 100,
          },
        },
        setProfileInfo: mockSetProfileInfo,
      };
      return selector(state);
    }),
    {
      getState: () => ({
        profileInfo: {
          AstrometrySettings: {
            Latitude: 51.5,
            Longitude: -0.1,
            Elevation: 100,
          },
        },
      }),
    }
  ),
}));

// Mock StelWebEngine - use explicit any for test mocks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockStelEngine = (): any => ({
  core: {
    observer: { latitude: 0, longitude: 0, elevation: 0 },
    fov: 1.047, // ~60 degrees in radians
    projection: 1,
    time_speed: 1,
    selection: null,
    stars: { addDataSource: jest.fn() },
    skycultures: { addDataSource: jest.fn() },
    dsos: { addDataSource: jest.fn() },
    dss: { addDataSource: jest.fn() },
    milkyway: { addDataSource: jest.fn() },
    minor_planets: { addDataSource: jest.fn() },
    planets: { addDataSource: jest.fn() },
    comets: { addDataSource: jest.fn() },
  },
  observer: { latitude: 0, longitude: 0, elevation: 0, utc: 0, azalt: [0, 0] },
  D2R: Math.PI / 180,
  R2D: 180 / Math.PI,
  getObj: jest.fn(),
  createObj: jest.fn(() => ({ pos: [0, 0, 0], update: jest.fn() })),
  createLayer: jest.fn(),
  convertFrame: jest.fn(() => [0, 0, -1]),
  c2s: jest.fn(() => [0, 0]),
  s2c: jest.fn(() => [0, 0, 1]),
  anp: jest.fn((x: number) => x),
  anpm: jest.fn((x: number) => x),
  pointAndLock: jest.fn(),
  change: jest.fn(),
});

describe('useStellariumZoom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports the hook correctly', async () => {
    const { useStellariumZoom } = await import('@/lib/hooks/stellarium/use-stellarium-zoom');
    expect(useStellariumZoom).toBeDefined();
    expect(typeof useStellariumZoom).toBe('function');
  });

  it('provides zoom functions', async () => {
    const { useStellariumZoom } = await import('@/lib/hooks/stellarium/use-stellarium-zoom');
    const mockStel = createMockStelEngine();
    const stelRef = { current: mockStel };
    const canvasRef = { current: document.createElement('canvas') };
    const onFovChange = jest.fn();

    const { result } = renderHook(() =>
      useStellariumZoom({ stelRef, canvasRef, onFovChange })
    );

    expect(result.current.zoomIn).toBeDefined();
    expect(result.current.zoomOut).toBeDefined();
    expect(result.current.setFov).toBeDefined();
    expect(result.current.getFov).toBeDefined();
  });

  it('zoomIn decreases FOV', async () => {
    const { useStellariumZoom } = await import('@/lib/hooks/stellarium/use-stellarium-zoom');
    const mockStel = createMockStelEngine();
    mockStel.core.fov = Math.PI / 3; // 60 degrees
    const stelRef = { current: mockStel };
    const canvasRef = { current: document.createElement('canvas') };
    const onFovChange = jest.fn();

    const { result } = renderHook(() =>
      useStellariumZoom({ stelRef, canvasRef, onFovChange })
    );

    const initialFov = mockStel.core.fov;
    act(() => {
      result.current.zoomIn();
    });

    expect(mockStel.core.fov).toBeLessThan(initialFov);
  });

  it('zoomOut increases FOV', async () => {
    const { useStellariumZoom } = await import('@/lib/hooks/stellarium/use-stellarium-zoom');
    const mockStel = createMockStelEngine();
    mockStel.core.fov = Math.PI / 3; // 60 degrees
    const stelRef = { current: mockStel };
    const canvasRef = { current: document.createElement('canvas') };
    const onFovChange = jest.fn();

    const { result } = renderHook(() =>
      useStellariumZoom({ stelRef, canvasRef, onFovChange })
    );

    const initialFov = mockStel.core.fov;
    act(() => {
      result.current.zoomOut();
    });

    expect(mockStel.core.fov).toBeGreaterThan(initialFov);
  });

  it('setFov sets specific FOV value', async () => {
    const { useStellariumZoom } = await import('@/lib/hooks/stellarium/use-stellarium-zoom');
    const mockStel = createMockStelEngine();
    const stelRef = { current: mockStel };
    const canvasRef = { current: document.createElement('canvas') };
    const onFovChange = jest.fn();

    const { result } = renderHook(() =>
      useStellariumZoom({ stelRef, canvasRef, onFovChange })
    );

    act(() => {
      result.current.setFov(45);
    });

    // FOV should be set (in radians)
    expect(onFovChange).toHaveBeenCalledWith(45);
  });

  it('getFov returns current FOV in degrees', async () => {
    const { useStellariumZoom } = await import('@/lib/hooks/stellarium/use-stellarium-zoom');
    const mockStel = createMockStelEngine();
    mockStel.core.fov = Math.PI / 3; // 60 degrees in radians
    const stelRef = { current: mockStel };
    const canvasRef = { current: document.createElement('canvas') };

    const { result } = renderHook(() =>
      useStellariumZoom({ stelRef, canvasRef })
    );

    const fov = result.current.getFov();
    expect(fov).toBeCloseTo(60, 0);
  });

  it('respects MIN_FOV limit', async () => {
    const { useStellariumZoom } = await import('@/lib/hooks/stellarium/use-stellarium-zoom');
    const { MIN_FOV } = await import('@/lib/core/constants/fov');
    const mockStel = createMockStelEngine();
    mockStel.core.fov = MIN_FOV * (Math.PI / 180); // At minimum
    const stelRef = { current: mockStel };
    const canvasRef = { current: document.createElement('canvas') };
    const onFovChange = jest.fn();

    const { result } = renderHook(() =>
      useStellariumZoom({ stelRef, canvasRef, onFovChange })
    );

    // Try to zoom in more (should be clamped)
    act(() => {
      result.current.setFov(0.1); // Below MIN_FOV
    });

    // Should be clamped to MIN_FOV
    expect(onFovChange).toHaveBeenCalledWith(MIN_FOV);
  });

  it('respects MAX_FOV limit', async () => {
    const { useStellariumZoom } = await import('@/lib/hooks/stellarium/use-stellarium-zoom');
    const { MAX_FOV } = await import('@/lib/core/constants/fov');
    const mockStel = createMockStelEngine();
    mockStel.core.fov = MAX_FOV * (Math.PI / 180); // At maximum
    const stelRef = { current: mockStel };
    const canvasRef = { current: document.createElement('canvas') };
    const onFovChange = jest.fn();

    const { result } = renderHook(() =>
      useStellariumZoom({ stelRef, canvasRef, onFovChange })
    );

    // Try to set FOV above max
    act(() => {
      result.current.setFov(200); // Above MAX_FOV
    });

    // Should be clamped to MAX_FOV
    expect(onFovChange).toHaveBeenCalledWith(MAX_FOV);
  });
});

describe('useClickCoordinates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports the hook correctly', async () => {
    const { useClickCoordinates } = await import('@/lib/hooks/stellarium/use-click-coordinates');
    expect(useClickCoordinates).toBeDefined();
    expect(typeof useClickCoordinates).toBe('function');
  });

  it('provides getClickCoordinates function', async () => {
    const { useClickCoordinates } = await import('@/lib/hooks/stellarium/use-click-coordinates');
    const stelRef = { current: null };
    const canvasRef = { current: null };

    const { result } = renderHook(() =>
      useClickCoordinates(stelRef, canvasRef)
    );

    expect(result.current.getClickCoordinates).toBeDefined();
    expect(typeof result.current.getClickCoordinates).toBe('function');
  });

  it('returns null when engine is not available', async () => {
    const { useClickCoordinates } = await import('@/lib/hooks/stellarium/use-click-coordinates');
    const stelRef = { current: null };
    const canvasRef = { current: document.createElement('canvas') };

    const { result } = renderHook(() =>
      useClickCoordinates(stelRef, canvasRef)
    );

    const coords = result.current.getClickCoordinates(100, 100);
    expect(coords).toBeNull();
  });

  it('returns null when canvas is not available', async () => {
    const { useClickCoordinates } = await import('@/lib/hooks/stellarium/use-click-coordinates');
    const mockStel = createMockStelEngine();
    const stelRef = { current: mockStel };
    const canvasRef = { current: null };

    const { result } = renderHook(() =>
      useClickCoordinates(stelRef, canvasRef)
    );

    const coords = result.current.getClickCoordinates(100, 100);
    expect(coords).toBeNull();
  });

  it('returns coordinates when engine and canvas are available', async () => {
    const { useClickCoordinates } = await import('@/lib/hooks/stellarium/use-click-coordinates');
    const mockStel = createMockStelEngine();
    const stelRef = { current: mockStel };
    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = jest.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));
    const canvasRef = { current: canvas };

    const { result } = renderHook(() =>
      useClickCoordinates(stelRef, canvasRef)
    );

    const coords = result.current.getClickCoordinates(400, 300);
    
    expect(coords).not.toBeNull();
    expect(coords).toHaveProperty('ra');
    expect(coords).toHaveProperty('dec');
    expect(coords).toHaveProperty('raStr');
    expect(coords).toHaveProperty('decStr');
  });
});

describe('useObserverSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports the hook correctly', async () => {
    const { useObserverSync } = await import('@/lib/hooks/stellarium/use-observer-sync');
    expect(useObserverSync).toBeDefined();
    expect(typeof useObserverSync).toBe('function');
  });

  it('syncs observer location from profile', async () => {
    const { useObserverSync } = await import('@/lib/hooks/stellarium/use-observer-sync');
    const mockStel = createMockStelEngine();
    const stelRef = { current: mockStel };

    renderHook(() => useObserverSync(stelRef));

    // Should have synced location from mock store (51.5, -0.1, 100)
    expect(mockStel.core.observer.latitude).toBeCloseTo(51.5 * (Math.PI / 180));
    expect(mockStel.core.observer.longitude).toBeCloseTo(-0.1 * (Math.PI / 180));
    expect(mockStel.core.observer.elevation).toBe(100);
  });

  it('supports persist hydration API when present', async () => {
    const stores = await import('@/lib/stores');
    const useMountStore = stores.useMountStore as unknown as {
      persist?: {
        onFinishHydration: (cb: () => void) => () => void;
        hasHydrated: () => boolean;
      };
    };

    useMountStore.persist = {
      onFinishHydration: (cb: () => void) => {
        cb();
        return jest.fn();
      },
      hasHydrated: () => true,
    };

    const { useObserverSync } = await import('@/lib/hooks/stellarium/use-observer-sync');
    const mockStel = createMockStelEngine();
    const stelRef = { current: mockStel };

    renderHook(() => useObserverSync(stelRef));

    expect(mockStel.core.observer.latitude).toBeCloseTo(51.5 * (Math.PI / 180));
    expect(mockStel.core.observer.longitude).toBeCloseTo(-0.1 * (Math.PI / 180));

    delete useMountStore.persist;
  });

  it('returns profileInfo', async () => {
    const { useObserverSync } = await import('@/lib/hooks/stellarium/use-observer-sync');
    const stelRef = { current: null };

    const { result } = renderHook(() => useObserverSync(stelRef));

    expect(result.current.profileInfo).toBeDefined();
    expect(result.current.profileInfo.AstrometrySettings).toBeDefined();
  });
});

describe('useSettingsSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('exports the hook correctly', async () => {
    const { useSettingsSync } = await import('@/lib/hooks/stellarium/use-settings-sync');
    expect(useSettingsSync).toBeDefined();
    expect(typeof useSettingsSync).toBe('function');
  });

  it('does not sync when engine is not ready', async () => {
    const { useSettingsSync } = await import('@/lib/hooks/stellarium/use-settings-sync');
    const mockStel = createMockStelEngine();
    const stelRef = { current: mockStel };

    renderHook(() => useSettingsSync(stelRef, false));

    // Advance timers
    act(() => {
      jest.advanceTimersByTime(100);
    });

    // updateStellariumCore should not be called
    expect(mockUpdateStellariumCore).not.toHaveBeenCalled();
  });

  it('syncs settings when engine is ready', async () => {
    const { useSettingsSync } = await import('@/lib/hooks/stellarium/use-settings-sync');
    const mockStel = createMockStelEngine();
    const stelRef = { current: mockStel };

    renderHook(() => useSettingsSync(stelRef, true));

    // Advance past debounce
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(mockUpdateStellariumCore).toHaveBeenCalled();
  });

  it('returns stellariumSettings', async () => {
    const { useSettingsSync } = await import('@/lib/hooks/stellarium/use-settings-sync');
    const stelRef = { current: null };

    const { result } = renderHook(() => useSettingsSync(stelRef, false));

    expect(result.current.stellariumSettings).toBeDefined();
  });
});

describe('useStellariumEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports the hook correctly', async () => {
    const { useStellariumEvents } = await import('@/lib/hooks/stellarium/use-stellarium-events');
    expect(useStellariumEvents).toBeDefined();
    expect(typeof useStellariumEvents).toBe('function');
  });

  it('attaches event listeners to container', async () => {
    const { useStellariumEvents } = await import('@/lib/hooks/stellarium/use-stellarium-events');
    const container = document.createElement('div');
    const containerRef = { current: container };
    const getClickCoordinates = jest.fn(() => ({ ra: 0, dec: 0, raStr: '0h', decStr: '0°' }));
    const onContextMenu = jest.fn();

    const addEventListenerSpy = jest.spyOn(container, 'addEventListener');

    renderHook(() =>
      useStellariumEvents({ containerRef, getClickCoordinates, onContextMenu })
    );

    // Should have added event listeners
    expect(addEventListenerSpy).toHaveBeenCalled();
    
    // Check for specific events
    const eventTypes = addEventListenerSpy.mock.calls.map(call => call[0]);
    expect(eventTypes).toContain('contextmenu');
    expect(eventTypes).toContain('mousedown');
    expect(eventTypes).toContain('touchstart');
  });

  it('does not open context menu when interaction starts on UI control surfaces', async () => {
    const { useStellariumEvents } = await import('@/lib/hooks/stellarium/use-stellarium-events');
    const container = document.createElement('div');
    const uiButton = document.createElement('button');
    uiButton.setAttribute('data-starmap-ui-control', 'true');
    container.appendChild(uiButton);

    const containerRef = { current: container };
    const getClickCoordinates = jest.fn(() => ({ ra: 0, dec: 0, raStr: '0h', decStr: '0°' }));
    const onContextMenu = jest.fn();

    renderHook(() =>
      useStellariumEvents({ containerRef, getClickCoordinates, onContextMenu })
    );

    uiButton.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 2,
      clientX: 20,
      clientY: 30,
    }));
    uiButton.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      button: 2,
      clientX: 20,
      clientY: 30,
    }));

    expect(onContextMenu).not.toHaveBeenCalled();
  });

  it('cleans up event listeners on unmount', async () => {
    const { useStellariumEvents } = await import('@/lib/hooks/stellarium/use-stellarium-events');
    const container = document.createElement('div');
    const containerRef = { current: container };
    const getClickCoordinates = jest.fn();

    const removeEventListenerSpy = jest.spyOn(container, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useStellariumEvents({ containerRef, getClickCoordinates })
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalled();
  });
});
