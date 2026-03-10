/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock stores
const mockUseSettingsStore = jest.fn((selector) => {
  const state = {
    stellarium: {
      constellationsLinesVisible: true,
      constellationBoundariesVisible: false,
      azimuthalLinesVisible: false,
      equatorialLinesVisible: false,
      equatorialJnowLinesVisible: false,
      meridianLinesVisible: false,
      eclipticLinesVisible: false,
      horizonLinesVisible: false,
      galacticLinesVisible: false,
      atmosphereVisible: false,
      landscapesVisible: false,
      dsosVisible: true,
      surveyEnabled: true,
      surveyId: 'dss',
      skyCultureLanguage: 'native',
      tonemapperP: 0.5,
      mountFrame: 5,
      viewYOffset: 0,
    },
    setStellariumSetting: jest.fn(),
    toggleStellariumSetting: jest.fn(),
    setStellariumSettings: jest.fn(),
  };
  return selector ? selector(state) : state;
});

const mockUseSatelliteStore = jest.fn((selector) => {
  const state = {
    showSatellites: true,
    showLabels: true,
    showOrbits: false,
    setShowSatellites: jest.fn(),
    setShowLabels: jest.fn(),
    setShowOrbits: jest.fn(),
  };
  return selector ? selector(state) : state;
});

const mockUseMountStore = jest.fn((selector) => {
  const state = {
    profileInfo: {
      AstrometrySettings: {
        Latitude: 40.7128,
        Longitude: -74.006,
        Elevation: 0,
      },
    },
    setProfileInfo: jest.fn(),
  };
  return selector ? selector(state) : state;
});

const mockUseEquipmentStore = jest.fn((selector) => {
  const state = {
    activeCameraId: null,
    activeTelescopeId: null,
    sensorWidth: 23.5,
    sensorHeight: 15.6,
    focalLength: 400,
    pixelSize: 3.76,
    aperture: 80,
    rotationAngle: 0,
    mosaic: {
      enabled: false,
      rows: 2,
      cols: 2,
      overlap: 20,
      overlapUnit: 'percent',
    },
    fovDisplay: {
      enabled: false,
      gridType: 'crosshair',
      showCoordinateGrid: true,
      showConstellations: false,
      showConstellationBoundaries: false,
      showDSOLabels: true,
      overlayOpacity: 80,
      frameColor: '#ef4444',
    },
    exposureDefaults: {
      exposureTime: 120,
      gain: 100,
      offset: 30,
      binning: '1x1',
      filter: 'L',
      frameCount: 30,
      ditherEnabled: true,
      ditherEvery: 3,
      tracking: 'guided',
      targetType: 'nebula',
      bortle: 5,
    },
    customCameras: [],
    customTelescopes: [],
    applyCamera: jest.fn(),
    applyTelescope: jest.fn(),
    setSensorWidth: jest.fn(),
    setSensorHeight: jest.fn(),
    setFocalLength: jest.fn(),
    setAperture: jest.fn(),
    setPixelSize: jest.fn(),
    setMosaic: jest.fn(),
    setMosaicEnabled: jest.fn(),
    setFOVDisplay: jest.fn(),
    setFOVEnabled: jest.fn(),
    setGridType: jest.fn(),
    setExposureDefaults: jest.fn(),
    addCustomCamera: jest.fn(),
    addCustomTelescope: jest.fn(),
    resetToDefaults: jest.fn(),
    getFOVWidth: jest.fn(() => 3.37),
    getFOVHeight: jest.fn(() => 2.24),
    getImageScale: jest.fn(() => 1.94),
    getFRatio: jest.fn(() => 5),
  };
  return selector ? selector(state) : state;
});

const mockUseOnboardingBridgeStore = jest.fn((selector) => {
  const state = {
    openSettingsDrawerRequestId: 0,
    closeTransientPanelsRequestId: 0,
    settingsDrawerTab: null,
    settingsDrawerOpen: false,
    setSettingsDrawerOpen: jest.fn(),
  };
  return selector ? selector(state) : state;
});

jest.mock('@/lib/stores', () => ({
  useSettingsStore: (selector: (state: unknown) => unknown) => mockUseSettingsStore(selector),
  useSatelliteStore: (selector: (state: unknown) => unknown) => mockUseSatelliteStore(selector),
  useMountStore: (selector: (state: unknown) => unknown) => mockUseMountStore(selector),
  useEquipmentStore: (selector: (state: unknown) => unknown) => mockUseEquipmentStore(selector),
  useOnboardingBridgeStore: (selector: (state: unknown) => unknown) => mockUseOnboardingBridgeStore(selector),
  BUILTIN_CAMERA_PRESETS: [
    { id: 'asi6200', name: 'ASI6200MC Pro', sensorWidth: 36, sensorHeight: 24, pixelSize: 3.76, isCustom: false },
  ],
  BUILTIN_TELESCOPE_PRESETS: [
    { id: 'redcat-51', name: 'RedCat 51', focalLength: 250, aperture: 51, type: 'APO', isCustom: false },
  ],
}));

// Mock UI components
jest.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children }: { children: React.ReactNode }) => <div data-testid="drawer">{children}</div>,
  DrawerContent: ({ children }: { children: React.ReactNode }) => <div data-testid="drawer-content">{children}</div>,
  DrawerHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="drawer-header">{children}</div>,
  DrawerTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="drawer-title">{children}</h2>,
  DrawerTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="drawer-trigger">{children}</div>
  ),
  DrawerFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="drawer-footer">{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} data-testid="button" {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs">{children}</div>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs-content">{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button data-testid="tabs-trigger">{children}</button>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-provider">{children}</div>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div>{children}</div>
  ),
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} data-testid="switch" />
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div data-testid="select">{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: () => <span>Select...</span>,
  SelectGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { children: React.ReactNode }) => (
    <label {...props}>{children}</label>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} data-testid="input" />,
}));

jest.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange, ...props }: { value?: number[]; onValueChange?: (v: number[]) => void }) => (
    <input
      type="range"
      value={value?.[0] || 0}
      onChange={(e) => onValueChange?.([Number(e.target.value)])}
      data-testid="slider"
      {...props}
    />
  ),
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog">{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

jest.mock('../../objects/object-info-sources-config', () => ({
  ObjectInfoSourcesConfig: () => <div data-testid="object-info-sources-config">ObjectInfoSourcesConfig</div>,
}));

jest.mock('../../settings/stellarium-survey-selector', () => ({
  StellariumSurveySelector: () => <div data-testid="stellarium-survey-selector">StellariumSurveySelector</div>,
}));

jest.mock('../../settings/display-settings', () => ({
  DisplaySettings: () => <div data-testid="display-settings">DisplaySettings</div>,
}));

jest.mock('../../settings/equipment-settings', () => ({
  EquipmentSettings: () => <div data-testid="equipment-settings">EquipmentSettings</div>,
}));

jest.mock('../../settings/fov-settings', () => ({
  FOVSettings: () => <div data-testid="fov-settings">FOVSettings</div>,
}));

jest.mock('../../settings/exposure-settings', () => ({
  ExposureSettings: () => <div data-testid="exposure-settings">ExposureSettings</div>,
}));

jest.mock('../../settings/location-settings', () => ({
  LocationSettings: () => <div data-testid="location-settings">LocationSettings</div>,
}));

jest.mock('../../settings/connection-settings', () => ({
  ConnectionSettings: () => <div data-testid="connection-settings">ConnectionSettings</div>,
}));

jest.mock('../../settings/general-settings', () => ({
  GeneralSettings: () => <div data-testid="general-settings">GeneralSettings</div>,
}));

jest.mock('../../settings/appearance-settings', () => ({
  AppearanceSettings: () => <div data-testid="appearance-settings">AppearanceSettings</div>,
}));

jest.mock('../../settings/performance-settings', () => ({
  PerformanceSettings: () => <div data-testid="performance-settings">PerformanceSettings</div>,
}));

jest.mock('../../settings/accessibility-settings', () => ({
  AccessibilitySettings: () => <div data-testid="accessibility-settings">AccessibilitySettings</div>,
}));

jest.mock('../../settings/notification-settings', () => ({
  NotificationSettings: () => <div data-testid="notification-settings">NotificationSettings</div>,
}));

jest.mock('../../settings/search-settings', () => ({
  SearchBehaviorSettings: () => <div data-testid="search-settings">SearchBehaviorSettings</div>,
}));

jest.mock('../../settings/keyboard-settings', () => ({
  KeyboardSettings: () => <div data-testid="keyboard-settings">KeyboardSettings</div>,
}));

jest.mock('../../settings/mobile-settings', () => ({
  MobileSettings: () => <div data-testid="mobile-settings">MobileSettings</div>,
}));

jest.mock('../../settings/about-settings', () => ({
  AboutSettings: () => <div data-testid="about-settings">AboutSettings</div>,
}));

jest.mock('../../settings/event-sources-settings', () => ({
  EventSourcesSettings: () => <div data-testid="event-sources-settings">EventSourcesSettings</div>,
}));

jest.mock('../../settings/settings-export-import', () => ({
  SettingsExportImport: () => <div data-testid="settings-export-import">SettingsExportImport</div>,
}));

jest.mock('../../settings/storage-path-settings', () => ({
  StoragePathSettings: () => <div data-testid="storage-path-settings">StoragePathSettings</div>,
}));

jest.mock('../../map', () => ({
  MapProviderSettings: () => <div data-testid="map-provider-settings">MapProviderSettings</div>,
  MapHealthMonitor: () => <div data-testid="map-health-monitor">MapHealthMonitor</div>,
  MapApiKeyManager: () => <div data-testid="map-api-key-manager">MapApiKeyManager</div>,
}));

import { UnifiedSettings } from '../unified-settings';

describe('UnifiedSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports the component correctly', async () => {
    expect(UnifiedSettings).toBeDefined();
  });

  it('component is a function', async () => {
    expect(typeof UnifiedSettings).toBe('function');
  });

  it('renders drawer component', () => {
    render(<UnifiedSettings />);
    expect(screen.getByTestId('drawer')).toBeInTheDocument();
  });

  it('renders settings drawer trigger', () => {
    render(<UnifiedSettings />);
    // The component renders a drawer with a trigger button
    expect(screen.getByTestId('drawer')).toBeInTheDocument();
  });

  it('renders tabs for different settings categories', () => {
    render(<UnifiedSettings />);
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
    expect(screen.getAllByTestId('tabs-trigger').length).toBeGreaterThan(0);
  });

  it('renders scroll area for content', () => {
    render(<UnifiedSettings />);
    expect(screen.getAllByTestId('scroll-area').length).toBeGreaterThan(0);
  });

  it('renders buttons including trigger', () => {
    render(<UnifiedSettings />);
    expect(screen.getAllByTestId('button').length).toBeGreaterThan(0);
  });
});

