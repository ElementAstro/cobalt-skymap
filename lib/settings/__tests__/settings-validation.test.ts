/**
 * @jest-environment jsdom
 */
import {
  createDefaultSettingsDraft,
} from '../settings-draft';
import {
  validateSettingsDraft,
} from '../settings-validation';

describe('settings-validation', () => {
  it('accepts the default draft', () => {
    const draft = createDefaultSettingsDraft();
    const result = validateSettingsDraft(draft);
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects invalid numeric ranges', () => {
    const draft = createDefaultSettingsDraft();
    draft.performance.maxStarsRendered = 200000;

    const result = validateSettingsDraft(draft);
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors['performance.maxStarsRendered']).toBeDefined();
  });

  it('rejects invalid enum values', () => {
    const draft = createDefaultSettingsDraft();
    draft.preferences.locale = 'jp' as 'en';

    const result = validateSettingsDraft(draft);
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors['preferences.locale']).toBeDefined();
  });

  it('enforces cross-field dependency rules', () => {
    const draft = createDefaultSettingsDraft();
    draft.preferences.dailyKnowledgeEnabled = false;
    draft.preferences.dailyKnowledgeAutoShow = true;

    const result = validateSettingsDraft(draft);
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors['preferences.dailyKnowledgeAutoShow']).toBeDefined();
  });
});

