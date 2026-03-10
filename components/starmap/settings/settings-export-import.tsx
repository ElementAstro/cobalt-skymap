'use client';

import { useState, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import {
  Download,
  Upload,
  FileJson,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useDailyKnowledgeStore,
  useSettingsStore,
  useEquipmentStore,
  useMountStore,
  useEventSourcesStore,
} from '@/lib/stores';
import type { EventSourceConfig } from '@/lib/stores';
import { useThemeStore } from '@/lib/stores/theme-store';
import { useKeybindingStore } from '@/lib/stores/keybinding-store';
import { useLocaleStore } from '@/lib/i18n/locale-store';
import {
  BARLOW_PRESETS,
  EYEPIECE_PRESETS,
  OCULAR_TELESCOPE_PRESETS,
} from '@/lib/constants/equipment-presets';
import { createSettingsDraftSnapshot } from '@/lib/settings/settings-draft';
import { validateSettingsDraft } from '@/lib/settings/settings-validation';
import { SettingsSection } from './settings-shared';

type ThemeMode = 'light' | 'dark' | 'system';
type ExportDomain =
  | 'settings'
  | 'theme'
  | 'keybindings'
  | 'equipment'
  | 'location'
  | 'eventSources'
  | 'dailyKnowledge';

const EXPORT_SCHEMA_VERSION = 5;
const SUPPORTED_IMPORT_VERSIONS = new Set([3, 4, 5]);
const SETTINGS_VALIDATION_CATEGORIES = new Set([
  'connection',
  'preferences',
  'performance',
  'accessibility',
  'notifications',
  'search',
]);

interface ExportMetadata {
  schemaVersion: number;
  domains: ExportDomain[];
}

function normalizeThemeMode(value: unknown): ThemeMode | null {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return null;
}

export interface ExportData {
  version: number;
  exportedAt: string;
  metadata?: ExportMetadata;
  themeMode?: ThemeMode;
  settings?: {
    connection: ReturnType<typeof useSettingsStore.getState>['connection'];
    backendProtocol: ReturnType<typeof useSettingsStore.getState>['backendProtocol'];
    skyEngine: ReturnType<typeof useSettingsStore.getState>['skyEngine'];
    stellarium: ReturnType<typeof useSettingsStore.getState>['stellarium'];
    preferences: ReturnType<typeof useSettingsStore.getState>['preferences'];
    performance: ReturnType<typeof useSettingsStore.getState>['performance'];
    accessibility: ReturnType<typeof useSettingsStore.getState>['accessibility'];
    notifications: ReturnType<typeof useSettingsStore.getState>['notifications'];
    search: ReturnType<typeof useSettingsStore.getState>['search'];
    aladinDisplay: ReturnType<typeof useSettingsStore.getState>['aladinDisplay'];
  };
  theme?: Partial<ReturnType<typeof useThemeStore.getState>['customization']>;
  keybindings?: ReturnType<typeof useKeybindingStore.getState>['customBindings'];
  equipment?: {
    sensorWidth: number;
    sensorHeight: number;
    focalLength: number;
    pixelSize: number;
    aperture: number;
    rotationAngle: number;
    mosaic: ReturnType<typeof useEquipmentStore.getState>['mosaic'];
    fovDisplay: ReturnType<typeof useEquipmentStore.getState>['fovDisplay'];
    ocularDisplay: ReturnType<typeof useEquipmentStore.getState>['ocularDisplay'];
    exposureDefaults: ReturnType<typeof useEquipmentStore.getState>['exposureDefaults'];
    customCameras: ReturnType<typeof useEquipmentStore.getState>['customCameras'];
    customTelescopes: ReturnType<typeof useEquipmentStore.getState>['customTelescopes'];
    customEyepieces: ReturnType<typeof useEquipmentStore.getState>['customEyepieces'];
    customBarlows: ReturnType<typeof useEquipmentStore.getState>['customBarlows'];
    customOcularTelescopes: ReturnType<typeof useEquipmentStore.getState>['customOcularTelescopes'];
    selectedOcularTelescopeId: ReturnType<typeof useEquipmentStore.getState>['selectedOcularTelescopeId'];
    selectedEyepieceId: ReturnType<typeof useEquipmentStore.getState>['selectedEyepieceId'];
    selectedBarlowId: ReturnType<typeof useEquipmentStore.getState>['selectedBarlowId'];
  };
  location?: {
    latitude: number;
    longitude: number;
    elevation: number;
  };
  eventSources?: EventSourceConfig[];
  dailyKnowledge?: {
    favorites: ReturnType<typeof useDailyKnowledgeStore.getState>['favorites'];
    history: ReturnType<typeof useDailyKnowledgeStore.getState>['history'];
    startupState: {
      lastShownDate: ReturnType<typeof useDailyKnowledgeStore.getState>['lastShownDate'];
      snoozedDate: ReturnType<typeof useDailyKnowledgeStore.getState>['snoozedDate'];
      lastSeenItemId: ReturnType<typeof useDailyKnowledgeStore.getState>['lastSeenItemId'];
    };
  };
}

interface ParsedImportResult {
  ok: boolean;
  data?: ExportData;
  invalidDomains: ExportDomain[];
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getDomainsFromPayload(payload: Partial<ExportData>): ExportDomain[] {
  const domains: ExportDomain[] = [];
  if (payload.settings) domains.push('settings');
  if (payload.theme) domains.push('theme');
  if (payload.keybindings) domains.push('keybindings');
  if (payload.equipment) domains.push('equipment');
  if (payload.location) domains.push('location');
  if (payload.eventSources) domains.push('eventSources');
  if (payload.dailyKnowledge) domains.push('dailyKnowledge');
  return domains;
}

function sanitizeSettingsDomain(settings: unknown): ExportData['settings'] | undefined {
  if (!isRecord(settings)) {
    return undefined;
  }
  return settings as ExportData['settings'];
}

function validateSettingsDomains(
  settings: ExportData['settings'] | undefined,
  location: ExportData['location'] | undefined,
): { settingsValid: boolean; locationValid: boolean } {
  const draft = createSettingsDraftSnapshot();

  if (settings?.connection) {
    draft.connection = { ...draft.connection, ...settings.connection };
  }
  if (settings?.backendProtocol) {
    draft.backendProtocol = settings.backendProtocol;
  }
  if (settings?.preferences) {
    draft.preferences = { ...draft.preferences, ...settings.preferences };
  }
  if (settings?.performance) {
    draft.performance = { ...draft.performance, ...settings.performance };
  }
  if (settings?.accessibility) {
    draft.accessibility = { ...draft.accessibility, ...settings.accessibility };
  }
  if (settings?.notifications) {
    draft.notifications = { ...draft.notifications, ...settings.notifications };
  }
  if (settings?.search) {
    draft.search = { ...draft.search, ...settings.search };
  }
  if (location) {
    draft.location = {
      latitude: location.latitude,
      longitude: location.longitude,
      elevation: location.elevation,
    };
  }

  const validation = validateSettingsDraft(draft);
  if (validation.isValid) {
    return { settingsValid: true, locationValid: true };
  }

  const hasSettingsValidationError = validation.issues.some((issue) =>
    SETTINGS_VALIDATION_CATEGORIES.has(issue.category),
  );
  const hasLocationValidationError = validation.issues.some((issue) => issue.category === 'location');

  return {
    settingsValid: !hasSettingsValidationError,
    locationValid: !hasLocationValidationError,
  };
}

export function parseImportedSettingsProfile(raw: unknown): ParsedImportResult {
  if (!isRecord(raw)) {
    return {
      ok: false,
      invalidDomains: [],
      error: 'Invalid settings file format',
    };
  }

  const version = raw.version;
  if (typeof version !== 'number' || !SUPPORTED_IMPORT_VERSIONS.has(version)) {
    return {
      ok: false,
      invalidDomains: [],
      error: 'Unsupported settings backup version',
    };
  }

  const settings = sanitizeSettingsDomain(raw.settings);
  const invalidDomains: ExportDomain[] = [];

  const normalized: ExportData = {
    version,
    exportedAt:
      typeof raw.exportedAt === 'string' && raw.exportedAt.trim().length > 0
        ? raw.exportedAt
        : new Date(0).toISOString(),
    settings,
    themeMode: normalizeThemeMode(raw.themeMode) ?? undefined,
    theme: isRecord(raw.theme) ? (raw.theme as ExportData['theme']) : undefined,
    keybindings: isRecord(raw.keybindings) ? (raw.keybindings as ExportData['keybindings']) : undefined,
    equipment: isRecord(raw.equipment) ? (raw.equipment as ExportData['equipment']) : undefined,
    location: isRecord(raw.location) ? (raw.location as ExportData['location']) : undefined,
    eventSources: Array.isArray(raw.eventSources)
      ? (raw.eventSources as ExportData['eventSources'])
      : undefined,
    dailyKnowledge: isRecord(raw.dailyKnowledge)
      ? (raw.dailyKnowledge as ExportData['dailyKnowledge'])
      : undefined,
  };

  if (raw.settings && !normalized.settings) {
    invalidDomains.push('settings');
  }

  if (raw.keybindings && !normalized.keybindings) {
    invalidDomains.push('keybindings');
  }

  if (raw.equipment && !normalized.equipment) {
    invalidDomains.push('equipment');
  }

  if (raw.location && !normalized.location) {
    invalidDomains.push('location');
  }

  if (raw.dailyKnowledge && !normalized.dailyKnowledge) {
    invalidDomains.push('dailyKnowledge');
  }

  if (normalized.settings || normalized.location) {
    const { settingsValid, locationValid } = validateSettingsDomains(
      normalized.settings,
      normalized.location,
    );
    if (!settingsValid) {
      normalized.settings = undefined;
      invalidDomains.push('settings');
    }
    if (!locationValid) {
      normalized.location = undefined;
      invalidDomains.push('location');
    }
  }

  const deduplicatedInvalidDomains = [...new Set(invalidDomains)];

  const metadataSource = isRecord(raw.metadata) ? raw.metadata : undefined;
  const metadataDomains = Array.isArray(metadataSource?.domains)
    ? metadataSource.domains.filter((domain): domain is ExportDomain => (
      typeof domain === 'string'
      && getDomainsFromPayload(normalized).includes(domain as ExportDomain)
    ))
    : getDomainsFromPayload(normalized);

  normalized.metadata = {
    schemaVersion:
      typeof metadataSource?.schemaVersion === 'number'
        ? metadataSource.schemaVersion
        : version,
    domains: metadataDomains,
  };

  if (normalized.metadata.domains.length === 0) {
    return {
      ok: false,
      invalidDomains: deduplicatedInvalidDomains,
      error: 'No importable settings domains found in file',
    };
  }

  return {
    ok: true,
    data: normalized,
    invalidDomains: deduplicatedInvalidDomains,
  };
}

export function applyImportedSettings(
  pendingImport: ExportData,
  applyThemeMode?: (mode: ThemeMode) => void
): void {
  const { settings, theme, keybindings } = pendingImport;

  // Apply settings
  if (settings) {
    const store = useSettingsStore.getState();
    if (settings.connection) store.setConnection(settings.connection);
    if (settings.backendProtocol) store.setBackendProtocol(settings.backendProtocol);
    if (settings.skyEngine) store.setSkyEngine(settings.skyEngine);
    if (settings.stellarium) store.setStellariumSettings(settings.stellarium);
    if (settings.preferences) {
      store.setPreferences(settings.preferences);
      useLocaleStore.getState().setLocale(settings.preferences.locale);
    }
    if (settings.performance) store.setPerformanceSettings(settings.performance);
    if (settings.accessibility) store.setAccessibilitySettings(settings.accessibility);
    if (settings.notifications) store.setNotificationSettings(settings.notifications);
    if (settings.search) store.setSearchSettings(settings.search);
    if (settings.aladinDisplay) store.setAladinDisplaySettings(settings.aladinDisplay);
  }

  if (pendingImport.themeMode && applyThemeMode) {
    const themeMode = normalizeThemeMode(pendingImport.themeMode);
    if (themeMode) {
      applyThemeMode(themeMode);
    }
  }

  // Apply theme customization
  if (theme) {
    const themeStore = useThemeStore.getState();
    themeStore.setCustomization({
      radius: theme.radius,
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      animationsEnabled: theme.animationsEnabled,
      activePreset: theme.activePreset,
      customColors: theme.customColors,
    });
  }

  // Apply keybindings
  if (keybindings) {
    const kbStore = useKeybindingStore.getState();
    kbStore.resetAllBindings();
    for (const [actionId, binding] of Object.entries(keybindings)) {
      kbStore.setBinding(actionId as keyof typeof keybindings, binding);
    }
  }

  // Apply equipment (v2+)
  const { equipment, location, eventSources, dailyKnowledge } = pendingImport;
  if (equipment) {
    const eqStore = useEquipmentStore.getState();
    if (equipment.sensorWidth !== undefined) eqStore.setSensorWidth(equipment.sensorWidth);
    if (equipment.sensorHeight !== undefined) eqStore.setSensorHeight(equipment.sensorHeight);
    if (equipment.focalLength !== undefined) eqStore.setFocalLength(equipment.focalLength);
    if (equipment.pixelSize !== undefined) eqStore.setPixelSize(equipment.pixelSize);
    if (equipment.aperture !== undefined) eqStore.setAperture(equipment.aperture);
    if (equipment.rotationAngle !== undefined) eqStore.setRotationAngle(equipment.rotationAngle);
    if (equipment.mosaic) eqStore.setMosaic(equipment.mosaic);
    if (equipment.fovDisplay) eqStore.setFOVDisplay(equipment.fovDisplay);
    if (equipment.ocularDisplay) eqStore.setOcularDisplay(equipment.ocularDisplay);
    if (equipment.exposureDefaults) eqStore.setExposureDefaults(equipment.exposureDefaults);

    // Restore custom presets (clear existing first to avoid duplicates)
    if (equipment.customCameras) {
      const existingCameras = eqStore.customCameras;
      for (const c of existingCameras) { eqStore.removeCustomCamera(c.id); }
      for (const cam of equipment.customCameras) {
        eqStore.addCustomCamera({ name: cam.name, sensorWidth: cam.sensorWidth, sensorHeight: cam.sensorHeight, pixelSize: cam.pixelSize });
      }
    }
    if (equipment.customTelescopes) {
      const existingTelescopes = eqStore.customTelescopes;
      for (const t of existingTelescopes) { eqStore.removeCustomTelescope(t.id); }
      for (const tel of equipment.customTelescopes) {
        eqStore.addCustomTelescope({ name: tel.name, focalLength: tel.focalLength, aperture: tel.aperture, type: tel.type });
      }
    }
    if (equipment.customEyepieces) {
      const existingEyepieces = eqStore.customEyepieces;
      for (const eyepiece of existingEyepieces) { eqStore.removeCustomEyepiece(eyepiece.id); }
      for (const eyepiece of equipment.customEyepieces) {
        eqStore.addCustomEyepiece({
          name: eyepiece.name,
          focalLength: eyepiece.focalLength,
          afov: eyepiece.afov,
          fieldStop: eyepiece.fieldStop,
        });
      }
    }
    if (equipment.customBarlows) {
      const existingBarlows = eqStore.customBarlows;
      for (const barlow of existingBarlows) { eqStore.removeCustomBarlow(barlow.id); }
      for (const barlow of equipment.customBarlows) {
        eqStore.addCustomBarlow({
          name: barlow.name,
          magnification: barlow.magnification,
        });
      }
    }
    if (equipment.customOcularTelescopes) {
      const existingOcularTelescopes = eqStore.customOcularTelescopes;
      for (const telescope of existingOcularTelescopes) { eqStore.removeCustomOcularTelescope(telescope.id); }
      for (const telescope of equipment.customOcularTelescopes) {
        eqStore.addCustomOcularTelescope({
          name: telescope.name,
          focalLength: telescope.focalLength,
          aperture: telescope.aperture,
          type: telescope.type,
        });
      }
    }
    const latestEquipmentState = useEquipmentStore.getState();
    const availableTelescopeIds = new Set([
      ...OCULAR_TELESCOPE_PRESETS.map((item) => item.id),
      ...latestEquipmentState.customOcularTelescopes.map((item) => item.id),
    ]);
    const availableEyepieceIds = new Set([
      ...EYEPIECE_PRESETS.map((item) => item.id),
      ...latestEquipmentState.customEyepieces.map((item) => item.id),
    ]);
    const availableBarlowIds = new Set([
      ...BARLOW_PRESETS.map((item) => item.id),
      ...latestEquipmentState.customBarlows.map((item) => item.id),
    ]);

    const fallbackTelescopeId = OCULAR_TELESCOPE_PRESETS[0]?.id;
    const fallbackEyepieceId = EYEPIECE_PRESETS[0]?.id;
    const fallbackBarlowId = BARLOW_PRESETS[0]?.id;

    const nextTelescopeId = equipment.selectedOcularTelescopeId && availableTelescopeIds.has(equipment.selectedOcularTelescopeId)
      ? equipment.selectedOcularTelescopeId
      : fallbackTelescopeId;
    const nextEyepieceId = equipment.selectedEyepieceId && availableEyepieceIds.has(equipment.selectedEyepieceId)
      ? equipment.selectedEyepieceId
      : fallbackEyepieceId;
    const nextBarlowId = equipment.selectedBarlowId && availableBarlowIds.has(equipment.selectedBarlowId)
      ? equipment.selectedBarlowId
      : fallbackBarlowId;

    if (nextTelescopeId) {
      latestEquipmentState.setSelectedOcularTelescopeId(nextTelescopeId);
    }
    if (nextEyepieceId) {
      latestEquipmentState.setSelectedEyepieceId(nextEyepieceId);
    }
    if (nextBarlowId) {
      latestEquipmentState.setSelectedBarlowId(nextBarlowId);
    }
  }

  // Apply location (v2+)
  if (location) {
    const mountStore = useMountStore.getState();
    mountStore.setProfileInfo({
      ...mountStore.profileInfo,
      AstrometrySettings: {
        Latitude: location.latitude,
        Longitude: location.longitude,
        Elevation: location.elevation,
      },
    });
  }

  // Apply event sources (v2+)
  if (eventSources) {
    const esStore = useEventSourcesStore.getState();
    esStore.resetToDefaults();
    for (const source of eventSources) {
      esStore.updateSource(source.id, source);
    }
  }

  const dailyKnowledgeStore = useDailyKnowledgeStore.getState();
  if (pendingImport.version >= 4 && dailyKnowledge) {
    dailyKnowledgeStore.hydrateFromImport({
      favorites: dailyKnowledge.favorites ?? [],
      history: dailyKnowledge.history ?? [],
      lastShownDate: dailyKnowledge.startupState?.lastShownDate ?? null,
      snoozedDate: dailyKnowledge.startupState?.snoozedDate ?? null,
      lastSeenItemId: dailyKnowledge.startupState?.lastSeenItemId ?? null,
    });
  } else if (pendingImport.version >= 4) {
    dailyKnowledgeStore.hydrateFromImport({
      favorites: [],
      history: [],
      lastShownDate: null,
      snoozedDate: null,
      lastSeenItemId: null,
    });
  } else if (pendingImport.version <= 3) {
    dailyKnowledgeStore.hydrateFromImport({
      favorites: [],
      history: [],
      lastShownDate: null,
      snoozedDate: null,
      lastSeenItemId: null,
    });
  }
}

export function SettingsExportImport() {
  const t = useTranslations();
  const { theme: currentThemeMode, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error' | 'warning'>('idle');
  const [importError, setImportError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<ExportData | null>(null);
  const [pendingInvalidDomains, setPendingInvalidDomains] = useState<ExportDomain[]>([]);

  const handleExport = useCallback(() => {
    const settingsState = useSettingsStore.getState();
    const themeState = useThemeStore.getState();
    const keybindingState = useKeybindingStore.getState();
    const equipmentState = useEquipmentStore.getState();
    const mountState = useMountStore.getState();
    const eventSourcesState = useEventSourcesStore.getState();
    const dailyKnowledgeState = useDailyKnowledgeStore.getState();

    const exportData: ExportData = {
      version: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      themeMode: normalizeThemeMode(currentThemeMode) ?? 'system',
      settings: {
        connection: settingsState.connection,
        backendProtocol: settingsState.backendProtocol,
        skyEngine: settingsState.skyEngine,
        stellarium: settingsState.stellarium,
        preferences: settingsState.preferences,
        performance: settingsState.performance,
        accessibility: settingsState.accessibility,
        notifications: settingsState.notifications,
        search: settingsState.search,
        aladinDisplay: settingsState.aladinDisplay,
      },
      theme: themeState.customization,
      keybindings: keybindingState.customBindings,
      equipment: {
        sensorWidth: equipmentState.sensorWidth,
        sensorHeight: equipmentState.sensorHeight,
        focalLength: equipmentState.focalLength,
        pixelSize: equipmentState.pixelSize,
        aperture: equipmentState.aperture,
        rotationAngle: equipmentState.rotationAngle,
        mosaic: equipmentState.mosaic,
        fovDisplay: equipmentState.fovDisplay,
        ocularDisplay: equipmentState.ocularDisplay,
        exposureDefaults: equipmentState.exposureDefaults,
        customCameras: equipmentState.customCameras,
        customTelescopes: equipmentState.customTelescopes,
        customEyepieces: equipmentState.customEyepieces,
        customBarlows: equipmentState.customBarlows,
        customOcularTelescopes: equipmentState.customOcularTelescopes,
        selectedOcularTelescopeId: equipmentState.selectedOcularTelescopeId,
        selectedEyepieceId: equipmentState.selectedEyepieceId,
        selectedBarlowId: equipmentState.selectedBarlowId,
      },
      location: {
        latitude: mountState.profileInfo.AstrometrySettings.Latitude,
        longitude: mountState.profileInfo.AstrometrySettings.Longitude,
        elevation: mountState.profileInfo.AstrometrySettings.Elevation,
      },
      eventSources: eventSourcesState.sources,
      dailyKnowledge: {
        favorites: dailyKnowledgeState.favorites,
        history: dailyKnowledgeState.history,
        startupState: {
          lastShownDate: dailyKnowledgeState.lastShownDate,
          snoozedDate: dailyKnowledgeState.snoozedDate,
          lastSeenItemId: dailyKnowledgeState.lastSeenItemId,
        },
      },
    };

    exportData.metadata = {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      domains: getDomainsFromPayload(exportData),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skymap-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currentThemeMode]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawData = JSON.parse(event.target?.result as string) as unknown;
        const parsed = parseImportedSettingsProfile(rawData);
        if (!parsed.ok || !parsed.data) {
          setImportStatus('error');
          setImportError(parsed.error ?? t('settingsNew.exportImport.invalidFile'));
          return;
        }
        setPendingImport(parsed.data);
        setPendingInvalidDomains(parsed.invalidDomains);
        if (parsed.invalidDomains.length > 0) {
          setImportStatus('warning');
          setImportError(`Skipped invalid domains: ${parsed.invalidDomains.join(', ')}`);
        } else {
          setImportStatus('idle');
          setImportError('');
        }
        setConfirmOpen(true);
      } catch {
        setImportStatus('error');
        setImportError(t('settingsNew.exportImport.parseError'));
      }
    };
    reader.readAsText(file);
    // Reset the input so the same file can be selected again
    e.target.value = '';
  }, [t]);

  const handleConfirmImport = useCallback(() => {
    if (!pendingImport) return;

    try {
      applyImportedSettings(pendingImport, setTheme);

      if (pendingInvalidDomains.length > 0) {
        setImportStatus('warning');
        setImportError(`Skipped invalid domains: ${pendingInvalidDomains.join(', ')}`);
      } else {
        setImportStatus('success');
        setImportError('');
      }
      setTimeout(() => setImportStatus('idle'), 3000);
    } catch {
      setImportStatus('error');
      setImportError(t('settingsNew.exportImport.importError'));
    }

    setPendingImport(null);
    setPendingInvalidDomains([]);
    setConfirmOpen(false);
  }, [pendingImport, pendingInvalidDomains, setTheme, t]);

  return (
    <div className="space-y-4">
      <SettingsSection
        title={t('settingsNew.exportImport.title')}
        icon={<FileJson className="h-4 w-4" />}
        defaultOpen={true}
      >
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {t('settingsNew.exportImport.description')}
          </p>

          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handleExport}
          >
            <Download className="h-4 w-4" />
            {t('settingsNew.exportImport.export')}
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {t('settingsNew.exportImport.import')}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileSelect}
          />

          {importStatus === 'success' && (
            <p className="text-xs text-green-500 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('settingsNew.exportImport.importSuccess')}
            </p>
          )}
          {importStatus === 'error' && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {importError}
            </p>
          )}
          {importStatus === 'warning' && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {importError}
            </p>
          )}
        </div>
      </SettingsSection>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settingsNew.exportImport.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settingsNew.exportImport.confirmDescription')}
              {pendingImport && (
                <span className="block mt-2 text-xs font-mono text-muted-foreground">
                  {t('settingsNew.exportImport.exportedAt')}: {new Date(pendingImport.exportedAt).toLocaleString()}
                  <br />
                  Schema: {pendingImport.metadata?.schemaVersion ?? pendingImport.version}
                  {pendingInvalidDomains.length > 0 && (
                    <>
                      <br />
                      Skipped domains: {pendingInvalidDomains.join(', ')}
                    </>
                  )}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>
              {t('settingsNew.exportImport.confirmImport')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
