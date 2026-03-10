/**
 * @jest-environment jsdom
 */
import type { ExportData } from '../settings-export-import';

const mockSetLocale = jest.fn();
const mockApplyThemeMode = jest.fn();

const settingsStoreState = {
  setConnection: jest.fn(),
  setBackendProtocol: jest.fn(),
  setSkyEngine: jest.fn(),
  setStellariumSettings: jest.fn(),
  setPreferences: jest.fn(),
  setPerformanceSettings: jest.fn(),
  setAccessibilitySettings: jest.fn(),
  setNotificationSettings: jest.fn(),
  setSearchSettings: jest.fn(),
  setAladinDisplaySettings: jest.fn(),
};

const equipmentStoreState = {
  customCameras: [] as Array<{ id: string }>,
  customTelescopes: [] as Array<{ id: string }>,
  customEyepieces: [] as Array<{ id: string }>,
  customBarlows: [] as Array<{ id: string }>,
  customOcularTelescopes: [] as Array<{ id: string }>,
  ocularDisplay: { enabled: false, opacity: 70, showCrosshair: true, appliedFov: null },
  setSensorWidth: jest.fn(),
  setSensorHeight: jest.fn(),
  setFocalLength: jest.fn(),
  setPixelSize: jest.fn(),
  setAperture: jest.fn(),
  setRotationAngle: jest.fn(),
  setMosaic: jest.fn(),
  setFOVDisplay: jest.fn(),
  setOcularDisplay: jest.fn(),
  setExposureDefaults: jest.fn(),
  removeCustomCamera: jest.fn(),
  addCustomCamera: jest.fn(),
  removeCustomTelescope: jest.fn(),
  addCustomTelescope: jest.fn(),
  removeCustomEyepiece: jest.fn(),
  addCustomEyepiece: jest.fn(),
  removeCustomBarlow: jest.fn(),
  addCustomBarlow: jest.fn(),
  removeCustomOcularTelescope: jest.fn(),
  addCustomOcularTelescope: jest.fn(),
  setSelectedOcularTelescopeId: jest.fn(),
  setSelectedEyepieceId: jest.fn(),
  setSelectedBarlowId: jest.fn(),
};

const mountStoreState = {
  profileInfo: { AstrometrySettings: { Latitude: 0, Longitude: 0, Elevation: 0 } },
  setProfileInfo: jest.fn(),
};

const eventSourcesStoreState = {
  resetToDefaults: jest.fn(),
  updateSource: jest.fn(),
};

const dailyKnowledgeStoreState = {
  hydrateFromImport: jest.fn(),
};

const themeStoreState = {
  setCustomization: jest.fn(),
};

const keybindingStoreState = {
  resetAllBindings: jest.fn(),
  setBinding: jest.fn(),
};

jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'dark',
    setTheme: jest.fn(),
  }),
}));

jest.mock('@/lib/stores', () => ({
  useSettingsStore: { getState: () => settingsStoreState },
  useEquipmentStore: { getState: () => equipmentStoreState },
  useMountStore: { getState: () => mountStoreState },
  useEventSourcesStore: { getState: () => eventSourcesStoreState },
  useDailyKnowledgeStore: { getState: () => dailyKnowledgeStoreState },
}));

jest.mock('@/lib/stores/theme-store', () => ({
  useThemeStore: { getState: () => themeStoreState },
}));

jest.mock('@/lib/stores/keybinding-store', () => ({
  useKeybindingStore: { getState: () => keybindingStoreState },
}));

jest.mock('@/lib/i18n/locale-store', () => ({
  useLocaleStore: { getState: () => ({ setLocale: mockSetLocale }) },
}));

import {
  applyImportedSettings,
  parseImportedSettingsProfile,
} from '../settings-export-import';

describe('applyImportedSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies settings fields and locale/theme linkage', () => {
    const data = {
      version: 3,
      exportedAt: '2026-01-01T00:00:00.000Z',
      themeMode: 'dark',
      settings: {
        connection: { ip: '127.0.0.1', port: '1888' },
        backendProtocol: 'https',
        skyEngine: 'aladin',
        stellarium: { nightMode: true },
        preferences: { locale: 'zh' },
        performance: { reducedMotion: true },
        accessibility: { highContrast: true },
        notifications: { enableToasts: false },
        search: { maxSearchResults: 20 },
        aladinDisplay: { showGrid: true },
      },
      keybindings: { TOGGLE_GRID: { key: 'g' } },
    } as unknown as ExportData;

    applyImportedSettings(data, mockApplyThemeMode);

    expect(settingsStoreState.setConnection).toHaveBeenCalledWith({ ip: '127.0.0.1', port: '1888' });
    expect(settingsStoreState.setBackendProtocol).toHaveBeenCalledWith('https');
    expect(settingsStoreState.setSkyEngine).toHaveBeenCalledWith('aladin');
    expect(settingsStoreState.setStellariumSettings).toHaveBeenCalledWith({ nightMode: true });
    expect(settingsStoreState.setAladinDisplaySettings).toHaveBeenCalledWith({ showGrid: true });
    expect(mockSetLocale).toHaveBeenCalledWith('zh');
    expect(mockApplyThemeMode).toHaveBeenCalledWith('dark');
    expect(keybindingStoreState.resetAllBindings).toHaveBeenCalled();
    expect(keybindingStoreState.setBinding).toHaveBeenCalledWith('TOGGLE_GRID', { key: 'g' });
  });

  it('imports numeric equipment values even when they are zero', () => {
    const data = {
      version: 3,
      exportedAt: '2026-01-01T00:00:00.000Z',
      settings: {} as unknown,
      keybindings: {},
      equipment: {
        sensorWidth: 0,
        sensorHeight: 0,
        focalLength: 0,
        pixelSize: 0,
        aperture: 0,
      },
    } as unknown as ExportData;

    applyImportedSettings(data);

    expect(equipmentStoreState.setSensorWidth).toHaveBeenCalledWith(0);
    expect(equipmentStoreState.setSensorHeight).toHaveBeenCalledWith(0);
    expect(equipmentStoreState.setFocalLength).toHaveBeenCalledWith(0);
    expect(equipmentStoreState.setPixelSize).toHaveBeenCalledWith(0);
    expect(equipmentStoreState.setAperture).toHaveBeenCalledWith(0);
  });

  it('imports ocular presets/selection and event sources', () => {
    equipmentStoreState.customEyepieces = [{ id: 'old-e' }];
    equipmentStoreState.customBarlows = [{ id: 'old-b' }];
    equipmentStoreState.customOcularTelescopes = [{ id: 'old-t' }];

    const data = {
      version: 3,
      exportedAt: '2026-01-01T00:00:00.000Z',
      settings: {} as unknown,
      keybindings: {},
      equipment: {
        customEyepieces: [{ name: 'EP', focalLength: 10, afov: 70 }],
        customBarlows: [{ name: '2x', magnification: 2 }],
        customOcularTelescopes: [{ name: 'Scope', focalLength: 800, aperture: 100, type: 'refractor' }],
        ocularDisplay: { enabled: true, opacity: 80, showCrosshair: false, appliedFov: 1.2 },
        selectedOcularTelescopeId: 'scope-1',
        selectedEyepieceId: 'ep-1',
        selectedBarlowId: 'barlow-1',
      },
      eventSources: [{ id: 'moon', enabled: true }],
    } as unknown as ExportData;

    applyImportedSettings(data);

    expect(equipmentStoreState.removeCustomEyepiece).toHaveBeenCalledWith('old-e');
    expect(equipmentStoreState.removeCustomBarlow).toHaveBeenCalledWith('old-b');
    expect(equipmentStoreState.removeCustomOcularTelescope).toHaveBeenCalledWith('old-t');
    expect(equipmentStoreState.addCustomEyepiece).toHaveBeenCalledWith({
      name: 'EP',
      focalLength: 10,
      afov: 70,
      fieldStop: undefined,
    });
    expect(equipmentStoreState.addCustomBarlow).toHaveBeenCalledWith({
      name: '2x',
      magnification: 2,
    });
    expect(equipmentStoreState.addCustomOcularTelescope).toHaveBeenCalledWith({
      name: 'Scope',
      focalLength: 800,
      aperture: 100,
      type: 'refractor',
    });
    expect(equipmentStoreState.setOcularDisplay).toHaveBeenCalledWith({ enabled: true, opacity: 80, showCrosshair: false, appliedFov: 1.2 });
    expect(equipmentStoreState.setSelectedOcularTelescopeId).toHaveBeenCalledWith('t1');
    expect(equipmentStoreState.setSelectedEyepieceId).toHaveBeenCalledWith('e1');
    expect(equipmentStoreState.setSelectedBarlowId).toHaveBeenCalledWith('b0');

    expect(eventSourcesStoreState.resetToDefaults).toHaveBeenCalled();
    expect(eventSourcesStoreState.updateSource).toHaveBeenCalledWith('moon', { id: 'moon', enabled: true });
  });

  it('ignores invalid theme mode values', () => {
    const data = {
      version: 3,
      exportedAt: '2026-01-01T00:00:00.000Z',
      themeMode: 'midnight',
      settings: {} as unknown,
      keybindings: {},
    } as unknown as ExportData;

    applyImportedSettings(data, mockApplyThemeMode);

    expect(mockApplyThemeMode).not.toHaveBeenCalled();
  });

  it('hydrates daily knowledge payload for v4 imports', () => {
    const data = {
      version: 4,
      exportedAt: '2026-01-01T00:00:00.000Z',
      settings: {} as unknown,
      keybindings: {},
      dailyKnowledge: {
        favorites: [{ itemId: 'curated-andromeda-distance', createdAt: 1 }],
        history: [{ itemId: 'curated-andromeda-distance', shownAt: 2, entry: 'manual', dateKey: '2026-01-01' }],
        startupState: {
          lastShownDate: '2026-01-01',
          snoozedDate: null,
          lastSeenItemId: 'curated-andromeda-distance',
        },
      },
    } as unknown as ExportData;

    applyImportedSettings(data);

    expect(dailyKnowledgeStoreState.hydrateFromImport).toHaveBeenCalledWith({
      favorites: [{ itemId: 'curated-andromeda-distance', createdAt: 1 }],
      history: [{ itemId: 'curated-andromeda-distance', shownAt: 2, entry: 'manual', dateKey: '2026-01-01' }],
      lastShownDate: '2026-01-01',
      snoozedDate: null,
      lastSeenItemId: 'curated-andromeda-distance',
    });
  });

  it('resets daily knowledge to defaults for legacy imports', () => {
    const data = {
      version: 3,
      exportedAt: '2026-01-01T00:00:00.000Z',
      settings: {} as unknown,
      keybindings: {},
    } as unknown as ExportData;

    applyImportedSettings(data);

    expect(dailyKnowledgeStoreState.hydrateFromImport).toHaveBeenCalledWith({
      favorites: [],
      history: [],
      lastShownDate: null,
      snoozedDate: null,
      lastSeenItemId: null,
    });
  });
});

describe('parseImportedSettingsProfile', () => {
  it('parses a legacy v4 payload and backfills metadata', () => {
    const parsed = parseImportedSettingsProfile({
      version: 4,
      exportedAt: '2026-01-01T00:00:00.000Z',
      settings: {
        connection: { ip: 'localhost', port: '1888' },
        backendProtocol: 'http',
      },
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.data?.metadata?.schemaVersion).toBe(4);
    expect(parsed.data?.metadata?.domains).toContain('settings');
  });

  it('rejects unsupported versions', () => {
    const parsed = parseImportedSettingsProfile({
      version: 999,
      settings: {},
    });

    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe('Unsupported settings backup version');
  });

  it('keeps importable domains and reports invalid domains', () => {
    const parsed = parseImportedSettingsProfile({
      version: 5,
      exportedAt: '2026-01-01T00:00:00.000Z',
      settings: {
        connection: { ip: '', port: '-1' },
        backendProtocol: 'https',
      },
      keybindings: {},
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.invalidDomains).toContain('settings');
    expect(parsed.data?.keybindings).toEqual({});
    expect(parsed.data?.metadata?.domains).toContain('keybindings');
  });
});
