import {
  DEFAULT_SESSION_CONSTRAINTS,
  isValidHhMm,
  validateSessionDraft,
} from '../session-draft-validator';

describe('session-draft-validator', () => {
  it('validates HH:mm values', () => {
    expect(isValidHhMm('00:00')).toBe(true);
    expect(isValidHhMm('23:59')).toBe(true);
    expect(isValidHhMm('24:00')).toBe(false);
    expect(isValidHhMm('03:60')).toBe(false);
    expect(isValidHhMm('9:30')).toBe(false);
  });

  it('returns blocking issue for partial session window', () => {
    const result = validateSessionDraft({
      planDate: '2025-01-01T00:00:00.000Z',
      strategy: 'balanced',
      constraints: {
        sessionWindow: { startTime: '22:00' },
      },
      excludedTargetIds: [],
      manualEdits: [],
    });

    expect(result.blockingIssues.some((issue) => issue.code === 'session-window')).toBe(true);
    expect(result.draft.constraints.sessionWindow).toBeUndefined();
  });

  it('drops unknown targets from manual edits and exclusions when known targets are provided', () => {
    const result = validateSessionDraft(
      {
        planDate: '2025-01-01T00:00:00.000Z',
        strategy: 'balanced',
        constraints: {},
        excludedTargetIds: ['known', 'unknown'],
        manualEdits: [
          { targetId: 'known', startTime: '22:00', durationMinutes: 60, locked: true },
          { targetId: 'unknown', startTime: '23:00', durationMinutes: 60, locked: true },
        ],
      },
      { knownTargetIds: new Set(['known']) },
    );

    expect(result.draft.excludedTargetIds).toEqual(['known']);
    expect(result.draft.manualEdits).toHaveLength(1);
    expect(result.draft.manualEdits[0].targetId).toBe('known');
    expect(result.warningIssues.some((issue) => issue.code === 'target-resolution')).toBe(true);
  });

  it('normalizes constraints with safe defaults', () => {
    const result = validateSessionDraft({
      planDate: 'invalid',
      strategy: 'invalid',
      constraints: {
        minAltitude: 999,
        minImagingTime: -1,
        minMoonDistance: -100,
      },
      excludedTargetIds: [],
      manualEdits: [],
    });

    expect(result.draft.constraints.minAltitude).toBe(90);
    expect(result.draft.constraints.minImagingTime).toBe(1);
    expect(result.draft.constraints.minMoonDistance).toBe(0);
    expect(result.draft.constraints.weatherLimits).toEqual(DEFAULT_SESSION_CONSTRAINTS.weatherLimits);
    expect(result.draft.strategy).toBe('balanced');
    expect(result.warningIssues.length).toBeGreaterThan(0);
  });
});

