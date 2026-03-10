import { optimizeScheduleV2 } from '../session-scheduler-v2';
import { DEFAULT_MOUNT_SAFETY_CONFIG } from '../mount-safety';
import type { TargetItem } from '@/lib/stores/target-list-store';
import type { TwilightTimes } from '@/lib/core/types/astronomy';
import type { SessionConstraintSet } from '@/types/starmap/session-planner-v2';

function makeTarget(overrides: Partial<TargetItem> & { id: string; name: string; ra: number; dec: number }): TargetItem {
  return {
    raString: '',
    decString: '',
    addedAt: Date.now(),
    status: 'planned',
    priority: 'medium',
    tags: [],
    isFavorite: false,
    isArchived: false,
    ...overrides,
  } as TargetItem;
}

function makeTwilight(planDate: Date, overrides: Partial<TwilightTimes> = {}): TwilightTimes {
  const dusk = new Date(planDate);
  dusk.setHours(20, 0, 0, 0);

  const dawn = new Date(planDate);
  dawn.setDate(dawn.getDate() + 1);
  dawn.setHours(4, 0, 0, 0);

  return {
    sunset: new Date(dusk.getTime() - 2 * 3600000),
    civilDusk: new Date(dusk.getTime() - 1.5 * 3600000),
    nauticalDusk: new Date(dusk.getTime() - 1 * 3600000),
    astronomicalDusk: dusk,
    astronomicalDawn: dawn,
    nauticalDawn: new Date(dawn.getTime() + 0.5 * 3600000),
    civilDawn: new Date(dawn.getTime() + 1 * 3600000),
    sunrise: new Date(dawn.getTime() + 2 * 3600000),
    nightDuration: 8,
    darknessDuration: 8,
    isCurrentlyNight: true,
    currentTwilightPhase: 'night',
    ...overrides,
  };
}

const LAT = 40;
const LON = -74;
const PLAN_DATE = new Date(2025, 5, 15, 0, 0, 0, 0);

const baseConstraints: SessionConstraintSet = {
  minAltitude: 20,
  minImagingTime: 30,
  weatherLimits: {
    maxCloudCover: 70,
    maxHumidity: 90,
    maxWindSpeed: 25,
  },
};

describe('optimizeScheduleV2', () => {
  it('resolves manual times across midnight (01:00 belongs to next-day night)', () => {
    const targets = [makeTarget({ id: 't1', name: 'Circumpolar', ra: 10.68, dec: 70 })];
    const twilight = makeTwilight(PLAN_DATE);

    const plan = optimizeScheduleV2(
      targets,
      LAT,
      LON,
      twilight,
      'balanced',
      baseConstraints,
      PLAN_DATE,
      new Set(),
      [{ targetId: 't1', startTime: '01:00', durationMinutes: 60, locked: true }],
    );

    expect(plan.targets).toHaveLength(1);
    const scheduled = plan.targets[0];

    expect(scheduled.target.id).toBe('t1');
    expect(scheduled.startTime.getFullYear()).toBe(twilight.astronomicalDawn?.getFullYear());
    expect(scheduled.startTime.getMonth()).toBe(twilight.astronomicalDawn?.getMonth());
    expect(scheduled.startTime.getDate()).toBe(twilight.astronomicalDawn?.getDate());
    expect(scheduled.startTime.getHours()).toBe(1);
    expect(Math.round(scheduled.duration * 60)).toBe(60);
  });

  it('treats locked items as hard constraints (auto targets never overlap locked windows)', () => {
    const targets = [
      makeTarget({ id: 't1', name: 'Locked', ra: 10.68, dec: 70 }),
      makeTarget({
        id: 't2',
        name: 'Auto',
        ra: 83.82,
        dec: 70,
        exposurePlan: { singleExposure: 300, totalExposure: 120, subFrames: 24, filter: 'L' },
      }),
    ];
    const twilight = makeTwilight(PLAN_DATE);

    const plan = optimizeScheduleV2(
      targets,
      LAT,
      LON,
      twilight,
      'balanced',
      baseConstraints,
      PLAN_DATE,
      new Set(),
      [{ targetId: 't1', startTime: '22:00', endTime: '23:00', locked: true }],
    );

    const locked = plan.targets.find((t) => t.target.id === 't1');
    const auto = plan.targets.find((t) => t.target.id === 't2');

    expect(locked).toBeTruthy();
    expect(auto).toBeTruthy();

    if (!locked || !auto) return;

    expect(auto.startTime < locked.endTime && auto.endTime > locked.startTime).toBe(false);

    const sorted = [...plan.targets].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].startTime.getTime()).toBeGreaterThanOrEqual(sorted[i - 1].endTime.getTime());
    }
  });

  it('uses exposurePlan.totalExposure (minutes) as desired duration when enabled', () => {
    const targets = [
      makeTarget({
        id: 't1',
        name: '60m',
        ra: 10.68,
        dec: 70,
        exposurePlan: { singleExposure: 300, totalExposure: 60, subFrames: 12, filter: 'L' },
      }),
      makeTarget({
        id: 't2',
        name: '120m',
        ra: 83.82,
        dec: 70,
        exposurePlan: { singleExposure: 300, totalExposure: 120, subFrames: 24, filter: 'L' },
      }),
    ];
    const twilight = makeTwilight(PLAN_DATE);

    const plan = optimizeScheduleV2(
      targets,
      LAT,
      LON,
      twilight,
      'balanced',
      baseConstraints,
      PLAN_DATE,
      new Set(),
      [],
    );

    const scheduled60 = plan.targets.find((t) => t.target.id === 't1');
    const scheduled120 = plan.targets.find((t) => t.target.id === 't2');

    expect(scheduled60).toBeTruthy();
    expect(scheduled120).toBeTruthy();

    if (!scheduled60 || !scheduled120) return;

    expect(Math.round(scheduled60.duration * 60)).toBe(60);
    expect(Math.round(scheduled120.duration * 60)).toBe(120);

    expect(scheduled60.desiredDurationMinutes).toBe(60);
    expect(scheduled120.desiredDurationMinutes).toBe(120);
  });

  it('enforces mount safety for auto targets but keeps locked targets with mount-safety conflict', () => {
    const targets = [makeTarget({ id: 't1', name: 'Unsafe', ra: 10.68, dec: 70 })];
    const twilight = makeTwilight(PLAN_DATE);

    const mountSafetyConfig = {
      ...DEFAULT_MOUNT_SAFETY_CONFIG,
      declinationLimitMin: 0,
      declinationLimitMax: 0,
    };

    const constraints: SessionConstraintSet = {
      ...baseConstraints,
      safetyLimits: { enforceMountSafety: true },
    };

    const autoPlan = optimizeScheduleV2(
      targets,
      LAT,
      LON,
      twilight,
      'balanced',
      constraints,
      PLAN_DATE,
      new Set(),
      [],
      undefined,
      { mountSafetyConfig },
    );

    expect(autoPlan.targets).toHaveLength(0);

    const lockedPlan = optimizeScheduleV2(
      targets,
      LAT,
      LON,
      twilight,
      'balanced',
      constraints,
      PLAN_DATE,
      new Set(),
      [{ targetId: 't1', startTime: '22:00', durationMinutes: 60, locked: true }],
      undefined,
      { mountSafetyConfig },
    );

    expect(lockedPlan.targets).toHaveLength(1);
    expect(lockedPlan.conflicts.some((conflict) => conflict.type === 'mount-safety')).toBe(true);
  });

  it('adds weather conflicts and weather warning when exceeding limits', () => {
    const targets = [makeTarget({ id: 't1', name: 'M31', ra: 10.68, dec: 70 })];
    const twilight = makeTwilight(PLAN_DATE);

    const plan = optimizeScheduleV2(
      targets,
      LAT,
      LON,
      twilight,
      'balanced',
      baseConstraints,
      PLAN_DATE,
      new Set(),
      [{ targetId: 't1', startTime: '22:00', durationMinutes: 90, locked: true }],
      {
        cloudCover: 95,
        humidity: 85,
        windSpeed: 10,
        source: 'manual',
        capturedAt: PLAN_DATE.toISOString(),
      },
    );

    expect(plan.conflicts.some((conflict) => conflict.type === 'weather')).toBe(true);
    expect(plan.warnings.some((warning) => warning.key === 'planRec.weatherNotIdeal')).toBe(true);
  });

  it('returns stable reason code for invalid session window values', () => {
    const targets = [makeTarget({ id: 't1', name: 'M31', ra: 10.68, dec: 70 })];
    const twilight = makeTwilight(PLAN_DATE);

    const plan = optimizeScheduleV2(
      targets,
      LAT,
      LON,
      twilight,
      'balanced',
      {
        ...baseConstraints,
        sessionWindow: {
          startTime: '99:00',
          endTime: '02:00',
        },
      },
      PLAN_DATE,
      new Set(),
      [],
    );

    expect(plan.conflicts[0]?.type).toBe('session-window');
    expect(plan.conflicts[0]?.reasonCode).toBe('invalid-session-window');
  });

  it('returns stable reason code when session window has no overlap with night', () => {
    const targets = [makeTarget({ id: 't1', name: 'M31', ra: 10.68, dec: 70 })];
    const twilight = makeTwilight(PLAN_DATE);

    const plan = optimizeScheduleV2(
      targets,
      LAT,
      LON,
      twilight,
      'balanced',
      {
        ...baseConstraints,
        sessionWindow: {
          startTime: '10:00',
          endTime: '12:00',
        },
      },
      PLAN_DATE,
      new Set(),
      [],
    );

    expect(plan.conflicts[0]?.type).toBe('session-window');
    expect(plan.conflicts[0]?.reasonCode).toBe('session-window-no-overlap');
  });
});
