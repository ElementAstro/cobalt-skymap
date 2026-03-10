import type {
  AstronomicalFrame,
  CoordinateQualityFlag,
  EopFreshness,
  ImagingFeasibility,
  SelectedObjectData,
  TargetVisibility,
  TimeScale,
} from '@/lib/core/types';
import type { ObjectDetailedInfo } from '@/lib/services/object-info-service';

export const TARGET_INFO_SECTION_ORDER = [
  'identity',
  'liveStatus',
  'planningMetrics',
  'advancedMetadata',
] as const;

export const TARGET_DISPLAY_THRESHOLDS = {
  altitude: {
    observableAboveHorizonDeg: 0,
    optimalImagingDeg: 30,
  },
  moonInterference: {
    moderateMinDistanceDeg: 30,
    lowMinDistanceDeg: 60,
  },
} as const;

export type AltitudeVisibilityState = 'below_horizon' | 'observable' | 'optimal';
export type MoonInterferenceLevel = 'high' | 'moderate' | 'low';

export interface TargetAstroDisplayData {
  altitude: number;
  azimuth: number;
  moonDistance: number;
  visibility: TargetVisibility;
  feasibility: ImagingFeasibility;
  frame: AstronomicalFrame;
  timeScale: TimeScale;
  qualityFlag: CoordinateQualityFlag;
  dataFreshness: EopFreshness;
  updatedAt: string;
  riskHints: string[];
}

export interface TargetDisplayIdentitySection {
  primaryName: string;
  aliases: string[];
  type: string | null;
  magnitude: string | null;
  size: string | null;
  constellation: string | null;
  coordinates: {
    ra: string;
    dec: string;
  };
}

export interface TargetDisplayLiveStatusSection {
  altitude: string;
  azimuth: string;
  altitudeState: AltitudeVisibilityState;
  moonInterferenceLevel: MoonInterferenceLevel;
  riskHints: string[];
}

export interface TargetDisplayPlanningMetricsSection {
  moonDistance: string;
  maxAltitude: string;
  feasibilityScore: number;
  visibility: TargetVisibility;
  feasibility: ImagingFeasibility;
}

export interface TargetDisplayAdvancedMetadataSection {
  frame: AstronomicalFrame;
  timeScale: TimeScale;
  qualityFlag: CoordinateQualityFlag;
  dataFreshness: EopFreshness;
  updatedAt: string | null;
}

export interface TargetDisplayModel {
  sections: {
    identity: TargetDisplayIdentitySection;
    liveStatus: TargetDisplayLiveStatusSection | null;
    planningMetrics: TargetDisplayPlanningMetricsSection | null;
    advancedMetadata: TargetDisplayAdvancedMetadataSection | null;
  };
}

export interface BuildTargetDisplayModelInput {
  selectedObject: SelectedObjectData | null;
  targetData?: TargetAstroDisplayData | null;
  objectInfo?: ObjectDetailedInfo | null;
  translatedPrimaryName?: string | null;
  translatedSecondaryNames?: string[] | null;
  locale?: string;
}

export function getAltitudeVisibilityState(altitude: number): AltitudeVisibilityState {
  if (altitude <= TARGET_DISPLAY_THRESHOLDS.altitude.observableAboveHorizonDeg) {
    return 'below_horizon';
  }
  if (altitude >= TARGET_DISPLAY_THRESHOLDS.altitude.optimalImagingDeg) {
    return 'optimal';
  }
  return 'observable';
}

export function getMoonInterferenceLevel(moonDistanceDeg: number): MoonInterferenceLevel {
  if (moonDistanceDeg >= TARGET_DISPLAY_THRESHOLDS.moonInterference.lowMinDistanceDeg) {
    return 'low';
  }
  if (moonDistanceDeg >= TARGET_DISPLAY_THRESHOLDS.moonInterference.moderateMinDistanceDeg) {
    return 'moderate';
  }
  return 'high';
}

export function getAltitudeStateTextClass(state: AltitudeVisibilityState): string {
  switch (state) {
    case 'optimal':
      return 'text-green-400';
    case 'observable':
      return 'text-yellow-400';
    case 'below_horizon':
      return 'text-red-400';
    default:
      return 'text-muted-foreground';
  }
}

export function getMoonInterferenceTextClass(level: MoonInterferenceLevel): string {
  switch (level) {
    case 'low':
      return 'text-green-400';
    case 'moderate':
      return 'text-yellow-400';
    case 'high':
      return 'text-orange-400';
    default:
      return 'text-muted-foreground';
  }
}

export function formatAngle(value: number, fractionDigits: number = 1): string {
  return `${value.toFixed(fractionDigits)}°`;
}

export function formatMagnitude(value?: number | null, fractionDigits: number = 1): string | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return value.toFixed(fractionDigits);
}

export function formatMoonDistance(value: number, fractionDigits: number = 0): string {
  return `${value.toFixed(fractionDigits)}°`;
}

export function formatTargetTimestamp(
  value: string | Date | null | undefined,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    ...options,
  });
}

export function buildTargetDisplayModel({
  selectedObject,
  targetData,
  objectInfo,
  translatedPrimaryName,
  translatedSecondaryNames,
  locale,
}: BuildTargetDisplayModelInput): TargetDisplayModel | null {
  if (!selectedObject) return null;

  const aliases = (translatedSecondaryNames && translatedSecondaryNames.length > 0)
    ? translatedSecondaryNames
    : selectedObject.names.slice(1, 3);
  const rawMagnitude = objectInfo?.magnitude ?? selectedObject.magnitude;
  const rawSize = objectInfo?.angularSize ?? selectedObject.size ?? null;

  const identity: TargetDisplayIdentitySection = {
    primaryName: translatedPrimaryName || selectedObject.names[0] || 'Unknown',
    aliases,
    type: objectInfo?.type ?? selectedObject.type ?? null,
    magnitude: formatMagnitude(rawMagnitude),
    size: rawSize,
    constellation: selectedObject.constellation ?? null,
    coordinates: {
      ra: selectedObject.ra,
      dec: selectedObject.dec,
    },
  };

  if (!targetData) {
    return {
      sections: {
        identity,
        liveStatus: null,
        planningMetrics: null,
        advancedMetadata: null,
      },
    };
  }

  const liveStatus: TargetDisplayLiveStatusSection = {
    altitude: formatAngle(targetData.altitude),
    azimuth: formatAngle(targetData.azimuth),
    altitudeState: getAltitudeVisibilityState(targetData.altitude),
    moonInterferenceLevel: getMoonInterferenceLevel(targetData.moonDistance),
    riskHints: targetData.riskHints ?? [],
  };

  const planningMetrics: TargetDisplayPlanningMetricsSection = {
    moonDistance: formatMoonDistance(targetData.moonDistance),
    maxAltitude: formatAngle(targetData.visibility.transitAltitude),
    feasibilityScore: targetData.feasibility.score,
    visibility: targetData.visibility,
    feasibility: targetData.feasibility,
  };

  const advancedMetadata: TargetDisplayAdvancedMetadataSection = {
    frame: targetData.frame,
    timeScale: targetData.timeScale,
    qualityFlag: targetData.qualityFlag,
    dataFreshness: targetData.dataFreshness,
    updatedAt: formatTargetTimestamp(targetData.updatedAt, locale),
  };

  return {
    sections: {
      identity,
      liveStatus,
      planningMetrics,
      advancedMetadata,
    },
  };
}
