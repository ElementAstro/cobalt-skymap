import type { TargetItem } from '@/lib/stores/target-list-store';
import type {
  OptimizationStrategy,
  I18nMessage,
} from '@/types/starmap/planning';
import type {
  ManualScheduleItem,
  SessionConflict,
  SessionConstraintSet,
  SessionDraftV2,
  SessionPlanV2,
  SessionWeatherSnapshot,
  ScheduledTargetWithLock,
} from '@/types/starmap/session-planner-v2';
import {
  angularSeparation,
  calculateImagingFeasibility,
  calculateTargetVisibility,
  getMoonPosition,
  getJulianDateFromDate,
  formatDuration,
  getMoonIllumination,
  getMoonPhase,
} from './astro-utils';
import type { TwilightTimes } from '@/lib/core/types/astronomy';
import { checkTargetSafety, type MountSafetyConfig } from './mount-safety';

interface TimeInterval {
  start: Date;
  end: Date;
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 60000);
}

function clampDate(date: Date, min: Date, max: Date): Date {
  const t = date.getTime();
  return new Date(Math.min(Math.max(t, min.getTime()), max.getTime()));
}

function intersectInterval(a: TimeInterval, b: TimeInterval): TimeInterval | null {
  const start = new Date(Math.max(a.start.getTime(), b.start.getTime()));
  const end = new Date(Math.min(a.end.getTime(), b.end.getTime()));
  return end.getTime() > start.getTime() ? { start, end } : null;
}

function subtractInterval(base: TimeInterval, remove: TimeInterval): TimeInterval[] {
  const baseStart = base.start.getTime();
  const baseEnd = base.end.getTime();
  const removeStart = remove.start.getTime();
  const removeEnd = remove.end.getTime();

  if (removeEnd <= baseStart || removeStart >= baseEnd) return [base];

  const next: TimeInterval[] = [];
  if (removeStart > baseStart) next.push({ start: base.start, end: new Date(removeStart) });
  if (removeEnd < baseEnd) next.push({ start: new Date(removeEnd), end: base.end });
  return next;
}

function subtractIntervals(base: TimeInterval, removes: TimeInterval[]): TimeInterval[] {
  const sorted = removes
    .slice()
    .sort((left, right) => left.start.getTime() - right.start.getTime());

  let segments: TimeInterval[] = [base];
  for (const remove of sorted) {
    segments = segments.flatMap((segment) => subtractInterval(segment, remove));
    if (segments.length === 0) return [];
  }
  return segments.sort((left, right) => left.start.getTime() - right.start.getTime());
}

function parseHHMM(timeString: string): { hours: number; minutes: number } | null {
  const parts = timeString.split(':');
  if (parts.length !== 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

function compareHHMM(left: string, right: string): number {
  // Strings are always HH:mm from `<input type="time">`, so lexicographic compare works.
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function getLocalDateAtTime(planDate: Date, dayOffset: number, hhmm: string): Date | null {
  const parsed = parseHHMM(hhmm);
  if (!parsed) return null;
  const base = new Date(planDate);
  base.setDate(base.getDate() + dayOffset);
  base.setHours(parsed.hours, parsed.minutes, 0, 0);
  return base;
}

export function resolveNightTime(planDate: Date, twilight: TwilightTimes, hhmm: string): Date | null {
  const candidate0 = getLocalDateAtTime(planDate, 0, hhmm);
  const candidate1 = getLocalDateAtTime(planDate, 1, hhmm);
  if (!candidate0 || !candidate1) return null;

  const dusk = twilight.astronomicalDusk;
  const dawn = twilight.astronomicalDawn;
  if (!dusk || !dawn) {
    return candidate0;
  }

  const duskTime = dusk.getTime();
  const dawnTime = dawn.getTime() > duskTime ? dawn.getTime() : dawn.getTime() + 86400000;
  const windowStart = duskTime - 6 * 3600000;
  const windowEnd = dawnTime + 6 * 3600000;

  const inWindow = (d: Date) => d.getTime() >= windowStart && d.getTime() <= windowEnd;
  const c0In = inWindow(candidate0);
  const c1In = inWindow(candidate1);
  if (c0In && !c1In) return candidate0;
  if (c1In && !c0In) return candidate1;

  const distanceToDusk = (d: Date) => Math.abs(d.getTime() - duskTime);
  return distanceToDusk(candidate1) < distanceToDusk(candidate0) ? candidate1 : candidate0;
}

function computeDesiredMinutes(target: TargetItem, constraints: SessionConstraintSet): number {
  const useExposure = constraints.useExposurePlanDuration !== false;
  const exposureMinutes = target.exposurePlan?.totalExposure;
  if (useExposure && typeof exposureMinutes === 'number' && exposureMinutes > 0) {
    return exposureMinutes;
  }
  return constraints.minImagingTime;
}

function buildScheduledTarget(
  target: TargetItem,
  visibilityData: ReturnType<typeof calculateTargetVisibility>,
  feasibility: ReturnType<typeof calculateImagingFeasibility>,
  startTime: Date,
  endTime: Date,
  moonDistance: number,
  order: number,
  extra: Pick<ScheduledTargetWithLock, 'locked' | 'manual' | 'desiredDurationMinutes'>,
): ScheduledTargetWithLock {
  return {
    target,
    startTime,
    endTime,
    duration: Math.max(0, (endTime.getTime() - startTime.getTime()) / 3600000),
    transitTime: visibilityData.transitTime,
    maxAltitude: visibilityData.transitAltitude,
    moonDistance,
    feasibility,
    conflicts: [],
    isOptimal: feasibility.score >= 70,
    order,
    ...extra,
  };
}

function makeConflict(
  type: SessionConflict['type'],
  targetId: string,
  reasonCode: string,
  message: string,
): SessionConflict {
  return {
    type,
    targetId,
    reasonCode,
    message,
  };
}

function detectConflicts(
  targets: ScheduledTargetWithLock[],
  constraints: SessionConstraintSet,
  weatherSnapshot?: SessionWeatherSnapshot,
): SessionConflict[] {
  const conflicts: SessionConflict[] = [];
  const minMoonDistance = constraints.minMoonDistance ?? 0;

  for (let index = 0; index < targets.length; index++) {
    const current = targets[index];
    const previous = targets[index - 1];

    if (previous && current.startTime.getTime() < previous.endTime.getTime()) {
      conflicts.push(makeConflict(
        'overlap',
        current.target.id,
        'overlap-with-previous',
        `${current.target.name} overlaps with ${previous.target.name}`,
      ));
    }

    if (current.maxAltitude < constraints.minAltitude) {
      conflicts.push(makeConflict(
        'altitude',
        current.target.id,
        'below-min-altitude',
        `${current.target.name} max altitude ${current.maxAltitude.toFixed(1)}° is below ${constraints.minAltitude}°`,
      ));
    }

    if (minMoonDistance > 0 && current.moonDistance < minMoonDistance) {
      conflicts.push(makeConflict(
        'moon-distance',
        current.target.id,
        'below-min-moon-distance',
        `${current.target.name} is ${current.moonDistance.toFixed(1)}° from moon (min ${minMoonDistance}°)`,
      ));
    }
  }

  if (constraints.weatherLimits && weatherSnapshot) {
    const { weatherLimits } = constraints;
    if (
      weatherLimits.maxCloudCover !== undefined &&
      weatherSnapshot.cloudCover !== undefined &&
      weatherSnapshot.cloudCover > weatherLimits.maxCloudCover
    ) {
      conflicts.push(makeConflict(
        'weather',
        'global',
        'cloud-cover-limit-exceeded',
        `Cloud cover ${weatherSnapshot.cloudCover}% exceeds ${weatherLimits.maxCloudCover}%`,
      ));
    }
    if (
      weatherLimits.maxHumidity !== undefined &&
      weatherSnapshot.humidity !== undefined &&
      weatherSnapshot.humidity > weatherLimits.maxHumidity
    ) {
      conflicts.push(makeConflict(
        'weather',
        'global',
        'humidity-limit-exceeded',
        `Humidity ${weatherSnapshot.humidity}% exceeds ${weatherLimits.maxHumidity}%`,
      ));
    }
    if (
      weatherLimits.maxWindSpeed !== undefined &&
      weatherSnapshot.windSpeed !== undefined &&
      weatherSnapshot.windSpeed > weatherLimits.maxWindSpeed
    ) {
      conflicts.push(makeConflict(
        'weather',
        'global',
        'wind-limit-exceeded',
        `Wind ${weatherSnapshot.windSpeed} km/h exceeds ${weatherLimits.maxWindSpeed} km/h`,
      ));
    }
  }

  return conflicts;
}

export function optimizeScheduleV2(
  targets: TargetItem[],
  latitude: number,
  longitude: number,
  twilight: TwilightTimes,
  strategy: OptimizationStrategy,
  constraints: SessionConstraintSet,
  planDate: Date,
  excludedIds: Set<string> = new Set(),
  manualEdits: ManualScheduleItem[] = [],
  weatherSnapshot?: SessionWeatherSnapshot,
  options?: {
    mountSafetyConfig?: MountSafetyConfig;
  },
): SessionPlanV2 {
  const accumulatedConflicts: SessionConflict[] = [];

  const nightStart = twilight.astronomicalDusk;
  const nightEnd = twilight.astronomicalDawn;
  if (!nightStart || !nightEnd) {
    return {
      targets: [],
      totalImagingTime: 0,
      nightCoverage: 0,
      efficiency: 0,
      gaps: [],
      recommendations: [],
      warnings: [],
      conflicts: [],
      weatherSnapshot,
    };
  }

  const normalizedNight: TimeInterval = {
    start: nightStart,
    end: nightEnd.getTime() > nightStart.getTime() ? nightEnd : new Date(nightEnd.getTime() + 86400000),
  };

  const sessionWindow = constraints.sessionWindow;
  let horizon: TimeInterval = normalizedNight;
  if (sessionWindow) {
    const resolvedStart = resolveNightTime(planDate, twilight, sessionWindow.startTime);
    const resolvedEnd = resolveNightTime(planDate, twilight, sessionWindow.endTime);
    if (!resolvedStart || !resolvedEnd) {
      accumulatedConflicts.push(makeConflict(
        'session-window',
        'global',
        'invalid-session-window',
        'Invalid session window time values',
      ));
      return {
        targets: [],
        totalImagingTime: 0,
        nightCoverage: 0,
        efficiency: 0,
        gaps: [],
        recommendations: [],
        warnings: [],
        conflicts: accumulatedConflicts,
        weatherSnapshot,
      };
    }

    let windowEnd = resolvedEnd;
    if (
      compareHHMM(sessionWindow.endTime, sessionWindow.startTime) <= 0 &&
      windowEnd.getTime() <= resolvedStart.getTime()
    ) {
      windowEnd = new Date(windowEnd.getTime() + 86400000);
    }
    const resolvedWindow: TimeInterval = { start: resolvedStart, end: windowEnd };

    const intersection = intersectInterval(normalizedNight, resolvedWindow);
    if (!intersection) {
      accumulatedConflicts.push(makeConflict(
        'session-window',
        'global',
        'session-window-no-overlap',
        'Session window has no overlap with astronomical night',
      ));
      return {
        targets: [],
        totalImagingTime: 0,
        nightCoverage: 0,
        efficiency: 0,
        gaps: [],
        recommendations: [],
        warnings: [],
        conflicts: accumulatedConflicts,
        weatherSnapshot,
      };
    }
    horizon = intersection;
  }

  const targetById = new Map(targets.map((target) => [target.id, target]));
  const manualByTargetId = new Map<string, ManualScheduleItem>();
  for (const edit of manualEdits) {
    if (!manualByTargetId.has(edit.targetId)) manualByTargetId.set(edit.targetId, edit);
  }

  const shouldCheckSafety =
    Boolean(options?.mountSafetyConfig) &&
    Boolean(constraints.safetyLimits?.enforceMountSafety || constraints.safetyLimits?.avoidMeridianFlipWindow);
  const mountSafetyConfig = options?.mountSafetyConfig;

  const visibilityReference = nightStart;

  // Phase A: locked intervals first (hard constraints)
  const lockedTargets: ScheduledTargetWithLock[] = [];
  const lockedIntervalsForSubtraction: TimeInterval[] = [];
  const lockedTargetIds = new Set<string>();

  for (const edit of manualEdits.filter((item) => Boolean(item.locked))) {
    const target = targetById.get(edit.targetId);
    if (!target || excludedIds.has(edit.targetId)) {
      accumulatedConflicts.push(makeConflict(
        'manual-time',
        edit.targetId,
        'manual-edit-unknown-target',
        `Manual edit refers to unknown or excluded target (${edit.targetId})`,
      ));
      continue;
    }

    const desiredMinutes = computeDesiredMinutes(target, constraints);

    const startFromEdit = edit.startTime ? resolveNightTime(planDate, twilight, edit.startTime) : null;
    const endFromEdit = edit.endTime ? resolveNightTime(planDate, twilight, edit.endTime) : null;

    let startTime: Date | null = startFromEdit;
    let endTime: Date | null = endFromEdit;

    if (!startTime && endTime && edit.durationMinutes && edit.durationMinutes > 0) {
      startTime = new Date(endTime.getTime() - edit.durationMinutes * 60000);
    }
    if (!endTime && startTime && edit.durationMinutes && edit.durationMinutes > 0) {
      endTime = new Date(startTime.getTime() + edit.durationMinutes * 60000);
    }

    if (!startTime || !endTime) {
      accumulatedConflicts.push(makeConflict(
        'manual-time',
        target.id,
        'manual-edit-invalid-time',
        `Invalid manual time for ${target.name}`,
      ));
      continue;
    }

    // Handle "cross-midnight" semantics when user provides both HH:mm values.
    if (edit.startTime && edit.endTime && compareHHMM(edit.endTime, edit.startTime) <= 0 && endTime <= startTime) {
      endTime = new Date(endTime.getTime() + 86400000);
    }

    if (endTime <= startTime) {
      accumulatedConflicts.push(makeConflict(
        'manual-time',
        target.id,
        'manual-edit-window-invalid',
        `Manual time window is not valid for ${target.name}`,
      ));
      continue;
    }

    const sampleTime = new Date(Math.floor((startTime.getTime() + endTime.getTime()) / 2));
    const moonPosition = getMoonPosition(getJulianDateFromDate(sampleTime));
    const moonDistance = angularSeparation(target.ra, target.dec, moonPosition.ra, moonPosition.dec);

    const visibility = calculateTargetVisibility(
      target.ra,
      target.dec,
      latitude,
      longitude,
      constraints.minAltitude,
      visibilityReference,
    );
    const feasibility = calculateImagingFeasibility(
      target.ra,
      target.dec,
      latitude,
      longitude,
      constraints.minAltitude,
      visibilityReference,
    );

    const scheduled = buildScheduledTarget(
      target,
      visibility,
      feasibility,
      startTime,
      endTime,
      moonDistance,
      lockedTargets.length + 1,
      { locked: true, manual: true, desiredDurationMinutes: desiredMinutes },
    );

    lockedTargets.push(scheduled);
    lockedTargetIds.add(target.id);

    const intersectionWithHorizon = intersectInterval({ start: startTime, end: endTime }, horizon);
    if (!intersectionWithHorizon) {
      accumulatedConflicts.push(makeConflict(
        'session-window',
        target.id,
        'locked-target-outside-session-window',
        `${target.name} locked time is outside session window`,
      ));
    } else {
      lockedIntervalsForSubtraction.push(intersectionWithHorizon);
    }

    if (shouldCheckSafety && mountSafetyConfig) {
      const safety = checkTargetSafety(
        target.id,
        target.name,
        target.ra,
        target.dec,
        startTime,
        endTime,
        latitude,
        longitude,
        mountSafetyConfig,
      );

      if (constraints.safetyLimits?.enforceMountSafety && !safety.isSafe) {
        accumulatedConflicts.push(makeConflict(
          'mount-safety',
          target.id,
          'mount-safety-limit-violation',
          `${target.name} violates mount safety limits`,
        ));
      }
      if (
        constraints.safetyLimits?.avoidMeridianFlipWindow &&
        safety.needsMeridianFlip &&
        safety.meridianFlipTime &&
        safety.meridianFlipTime.getTime() > startTime.getTime() &&
        safety.meridianFlipTime.getTime() < endTime.getTime()
      ) {
        accumulatedConflicts.push(makeConflict(
          'mount-safety',
          target.id,
          'locked-target-meridian-flip-window',
          `${target.name} requires meridian flip during locked window`,
        ));
      }
    }
  }

  // Free intervals = horizon - locked intervals (only the portion inside horizon matters for subtraction)
  let freeIntervals: TimeInterval[] = subtractIntervals(horizon, lockedIntervalsForSubtraction);

  // Phase B: schedule remaining targets into free intervals
  const activeTargets = excludedIds.size > 0 ? targets.filter((t) => !excludedIds.has(t.id)) : targets;
  const remainingTargets = activeTargets.filter((t) => !lockedTargetIds.has(t.id));

  const targetInfos = remainingTargets
    .map((target) => {
      const visibility = calculateTargetVisibility(
        target.ra,
        target.dec,
        latitude,
        longitude,
        constraints.minAltitude,
        visibilityReference,
      );
      const feasibility = calculateImagingFeasibility(
        target.ra,
        target.dec,
        latitude,
        longitude,
        constraints.minAltitude,
        visibilityReference,
      );
      const desiredMinutes = computeDesiredMinutes(target, constraints);

      const imagingStart = visibility.imagingWindowStart;
      const imagingEnd = visibility.imagingWindowEnd;
      const darkWindow =
        imagingStart && imagingEnd ? intersectInterval({ start: imagingStart, end: imagingEnd }, horizon) : null;
      const darkWindowMinutes = darkWindow ? minutesBetween(darkWindow.start, darkWindow.end) : 0;

      const manualEdit = manualByTargetId.get(target.id);
      const preferredStart =
        manualEdit && !manualEdit.locked && manualEdit.startTime
          ? resolveNightTime(planDate, twilight, manualEdit.startTime)
          : null;

      return {
        target,
        visibility,
        feasibility,
        desiredMinutes,
        darkWindow,
        darkWindowMinutes,
        manualEdit,
        preferredStart,
      };
    })
    .filter((info) => info.darkWindowMinutes >= constraints.minImagingTime);

  const priorityWeight: Record<TargetItem['priority'], number> = {
    high: 2,
    medium: 1,
    low: 0,
  };

  targetInfos.sort((a, b) => {
    const prio = priorityWeight[b.target.priority] - priorityWeight[a.target.priority];
    if (prio !== 0) return prio;
    switch (strategy) {
      case 'altitude':
        return b.visibility.transitAltitude - a.visibility.transitAltitude;
      case 'transit':
        return (a.visibility.transitTime?.getTime() ?? 0) - (b.visibility.transitTime?.getTime() ?? 0);
      case 'duration':
        return b.darkWindowMinutes - a.darkWindowMinutes;
      case 'moon':
        return b.feasibility.moonScore - a.feasibility.moonScore;
      case 'balanced':
      default:
        return b.feasibility.score - a.feasibility.score;
    }
  });

  const scheduledAuto: ScheduledTargetWithLock[] = [];

  const minMoonDistance = constraints.minMoonDistance ?? 0;
  const canShortSchedule = (windowMinutes: number) => windowMinutes >= constraints.minImagingTime;

  for (const info of targetInfos) {
    if (!info.darkWindow) continue;
    if (freeIntervals.length === 0) break;

    let best: {
      start: Date;
      end: Date;
      plannedMinutes: number;
      moonDistance: number;
      score: number;
    } | null = null;

    for (const free of freeIntervals) {
      const window = intersectInterval(free, info.darkWindow);
      if (!window) continue;

      const windowMinutes = minutesBetween(window.start, window.end);
      if (!canShortSchedule(windowMinutes)) continue;

      const plannedMinutes = Math.min(info.desiredMinutes, windowMinutes);
      if (!canShortSchedule(plannedMinutes)) continue;

      const durationMs = plannedMinutes * 60000;

      const endLimit = new Date(window.end.getTime() - durationMs);
      if (endLimit.getTime() < window.start.getTime()) continue;

      const startFromTransit = (() => {
        const mid = info.visibility.transitTime
          ? info.visibility.transitTime
          : new Date((window.start.getTime() + window.end.getTime()) / 2);
        return clampDate(new Date(mid.getTime() - durationMs / 2), window.start, endLimit);
      })();

      const starts = [
        info.preferredStart ? clampDate(info.preferredStart, window.start, endLimit) : null,
        startFromTransit,
        window.start,
        endLimit,
      ].filter((d): d is Date => Boolean(d));

      for (const start of starts) {
        const end = new Date(start.getTime() + durationMs);
        const midTime = new Date(Math.floor((start.getTime() + end.getTime()) / 2));
        const moonPosition = getMoonPosition(getJulianDateFromDate(midTime));
        const moonDistance = angularSeparation(
          info.target.ra,
          info.target.dec,
          moonPosition.ra,
          moonPosition.dec,
        );

        if (minMoonDistance > 0 && moonDistance < minMoonDistance) {
          continue;
        }

        if (shouldCheckSafety && mountSafetyConfig) {
          const safety = checkTargetSafety(
            info.target.id,
            info.target.name,
            info.target.ra,
            info.target.dec,
            start,
            end,
            latitude,
            longitude,
            mountSafetyConfig,
          );

          if (constraints.safetyLimits?.enforceMountSafety && !safety.isSafe) {
            continue;
          }
          if (
            constraints.safetyLimits?.avoidMeridianFlipWindow &&
            safety.needsMeridianFlip &&
            safety.meridianFlipTime &&
            safety.meridianFlipTime.getTime() > start.getTime() &&
            safety.meridianFlipTime.getTime() < end.getTime()
          ) {
            continue;
          }
        }

        const midToTransitMinutes = info.visibility.transitTime
          ? Math.abs(midTime.getTime() - info.visibility.transitTime.getTime()) / 60000
          : 0;
        const baseScore = (() => {
          switch (strategy) {
            case 'altitude':
              return info.visibility.transitAltitude * 10 + info.feasibility.score;
            case 'transit':
              return -midToTransitMinutes;
            case 'moon':
              return moonDistance;
            case 'duration':
              return plannedMinutes;
            case 'balanced':
            default:
              return info.feasibility.score * 3 + info.visibility.transitAltitude * 2 + moonDistance * 2 + plannedMinutes;
          }
        })();
        const score = baseScore + priorityWeight[info.target.priority] * 500;

        if (!best || score > best.score) {
          best = { start, end, plannedMinutes, moonDistance, score };
        }
      }
    }

    if (!best) continue;

    const scheduled = buildScheduledTarget(
      info.target,
      info.visibility,
      info.feasibility,
      best.start,
      best.end,
      best.moonDistance,
      scheduledAuto.length + 1,
      {
        locked: false,
        manual: Boolean(info.manualEdit && (info.manualEdit.startTime || info.manualEdit.endTime || info.manualEdit.durationMinutes)),
        desiredDurationMinutes: info.desiredMinutes,
      },
    );
    scheduledAuto.push(scheduled);

    if (best.plannedMinutes < info.desiredMinutes) {
      accumulatedConflicts.push(makeConflict(
        'insufficient-duration',
        info.target.id,
        'planned-duration-below-desired',
        `${info.target.name} planned ${Math.round(best.plannedMinutes)}m < desired ${Math.round(info.desiredMinutes)}m`,
      ));
    }

    // Subtract scheduled interval from free intervals
    freeIntervals = subtractIntervals({ start: horizon.start, end: horizon.end }, [
      ...lockedIntervalsForSubtraction,
      ...scheduledAuto.map((s) => ({ start: s.startTime, end: s.endTime })),
    ]);
  }

  const mergedTargets = [...lockedTargets, ...scheduledAuto]
    .sort((left, right) => left.startTime.getTime() - right.startTime.getTime())
    .map((target, index) => ({ ...target, order: index + 1 }));

  // Populate per-target overlap list (UI helper). Should be empty for autos.
  for (const current of mergedTargets) {
    const overlaps = mergedTargets
      .filter((other) => other.target.id !== current.target.id)
      .filter((other) => current.startTime < other.endTime && current.endTime > other.startTime)
      .map((other) => other.target.name);
    current.conflicts = overlaps;
  }

  // Calculate gaps within horizon
  const gaps: Array<{ start: Date; end: Date; duration: number }> = [];
  {
    let lastEnd = horizon.start.getTime();
    for (const s of mergedTargets) {
      const sStart = s.startTime.getTime();
      const sEnd = s.endTime.getTime();
      if (sStart > lastEnd) {
        const gapHours = (sStart - lastEnd) / 3600000;
        if (gapHours > 0.25) {
          gaps.push({ start: new Date(lastEnd), end: new Date(sStart), duration: gapHours });
        }
      }
      lastEnd = Math.max(lastEnd, sEnd);
    }
    if (lastEnd < horizon.end.getTime()) {
      const gapHours = (horizon.end.getTime() - lastEnd) / 3600000;
      if (gapHours > 0.25) {
        gaps.push({ start: new Date(lastEnd), end: new Date(horizon.end), duration: gapHours });
      }
    }
  }

  const totalImagingTime = mergedTargets.reduce((sum, target) => sum + target.duration, 0);
  const nightCoverage = twilight.darknessDuration > 0 ? (totalImagingTime / twilight.darknessDuration) * 100 : 0;
  const efficiency = mergedTargets.length > 0
    ? (mergedTargets.filter((target) => target.isOptimal).length / mergedTargets.length) * 100
    : 0;

  // Recommendations & warnings (keep v1 behavior)
  const recommendations: I18nMessage[] = [];
  const warnings: I18nMessage[] = [];
  const moonPhase = getMoonPhase(getJulianDateFromDate(planDate));
  const moonIllum = getMoonIllumination(moonPhase);

  if (nightCoverage < 50) recommendations.push({ key: 'planRec.addMoreTargets' });
  if (nightCoverage > 120) warnings.push({ key: 'planRec.tooManyForOneNight' });
  if (moonIllum > 70) warnings.push({ key: 'planRec.brightMoon' });

  const excellentTargets = mergedTargets.filter((t) => t.feasibility.recommendation === 'excellent');
  if (excellentTargets.length > 0) {
    recommendations.push({
      key: 'planRec.prioritize',
      params: { names: excellentTargets.map((t) => t.target.name).join(', ') },
    });
  }

  if (gaps.length > 0) {
    const totalGapTime = gaps.reduce((sum, g) => sum + g.duration, 0);
    if (totalGapTime > 1) {
      recommendations.push({ key: 'planRec.unusedDarkTime', params: { duration: formatDuration(totalGapTime) } });
    }
  }

  const conflicts = [
    ...detectConflicts(mergedTargets, constraints, weatherSnapshot),
    ...accumulatedConflicts,
  ];

  if (conflicts.some((conflict) => conflict.type === 'weather')) {
    warnings.push({ key: 'planRec.weatherNotIdeal' });
  }

  return {
    targets: mergedTargets,
    totalImagingTime,
    nightCoverage,
    efficiency,
    gaps,
    recommendations,
    warnings,
    conflicts,
    weatherSnapshot,
  };
}

export function createDraftFromSessionPlan(
  plan: SessionPlanV2,
  strategy: OptimizationStrategy,
  constraints: SessionConstraintSet,
  planDate: Date,
): SessionDraftV2 {
  return {
    planDate: planDate.toISOString(),
    strategy,
    constraints,
    excludedTargetIds: [],
    manualEdits: plan.targets.map((target) => ({
      targetId: target.target.id,
      startTime: target.startTime.toTimeString().slice(0, 5),
      endTime: target.endTime.toTimeString().slice(0, 5),
    })),
    weatherSnapshot: plan.weatherSnapshot,
  };
}
