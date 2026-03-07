/**
 * Tests for feedback-store.ts
 * Feedback draft management and preferences
 */

import { act } from '@testing-library/react';
import { useFeedbackStore } from '../feedback-store';

beforeEach(() => {
  act(() => {
    useFeedbackStore.getState().resetDraft();
  });
});

describe('useFeedbackStore', () => {
  it('should have a default draft with type bug', () => {
    const { draft } = useFeedbackStore.getState();
    expect(draft.type).toBe('bug');
    expect(draft.title).toBe('');
    expect(draft.description).toBe('');
  });

  it('should set feedback type', () => {
    act(() => {
      useFeedbackStore.getState().setType('feature');
    });
    expect(useFeedbackStore.getState().draft.type).toBe('feature');
  });

  it('should update draft fields', () => {
    act(() => {
      useFeedbackStore.getState().updateDraft({
        title: 'Bug Title',
        description: 'Bug Description',
      });
    });
    const { draft } = useFeedbackStore.getState();
    expect(draft.title).toBe('Bug Title');
    expect(draft.description).toBe('Bug Description');
  });

  it('should toggle includeSystemInfo preference', () => {
    act(() => {
      useFeedbackStore.getState().setIncludeSystemInfo(true);
    });
    expect(useFeedbackStore.getState().preferences.includeSystemInfo).toBe(true);
    expect(useFeedbackStore.getState().draft.includeSystemInfo).toBe(true);
  });

  it('should toggle includeLogs preference', () => {
    act(() => {
      useFeedbackStore.getState().setIncludeLogs(true);
    });
    expect(useFeedbackStore.getState().preferences.includeLogs).toBe(true);
    expect(useFeedbackStore.getState().draft.includeLogs).toBe(true);
  });

  it('should reset draft', () => {
    act(() => {
      useFeedbackStore.getState().updateDraft({ title: 'test' });
      useFeedbackStore.getState().resetDraft('feature');
    });
    const { draft } = useFeedbackStore.getState();
    expect(draft.title).toBe('');
    expect(draft.type).toBe('feature');
  });

  it('should clear draft content', () => {
    act(() => {
      useFeedbackStore.getState().updateDraft({ title: 'test', description: 'desc' });
      useFeedbackStore.getState().clearDraftContent();
    });
    const { draft } = useFeedbackStore.getState();
    expect(draft.title).toBe('');
    expect(draft.description).toBe('');
  });

  it('should set severity', () => {
    act(() => {
      useFeedbackStore.getState().setSeverity('critical');
    });
    expect(useFeedbackStore.getState().draft.severity).toBe('critical');
  });

  it('should set priority', () => {
    act(() => {
      useFeedbackStore.getState().setPriority('high');
    });
    expect(useFeedbackStore.getState().draft.priority).toBe('high');
  });

  it('should set and clear screenshot', () => {
    act(() => {
      useFeedbackStore.getState().setScreenshot('data:image/png;base64,abc');
    });
    expect(useFeedbackStore.getState().draft.screenshot).toBe('data:image/png;base64,abc');

    act(() => {
      useFeedbackStore.getState().setScreenshot(null);
    });
    expect(useFeedbackStore.getState().draft.screenshot).toBeNull();
  });

  it('should clear severity/priority/screenshot on clearDraftContent', () => {
    act(() => {
      useFeedbackStore.getState().setSeverity('major');
      useFeedbackStore.getState().setPriority('high');
      useFeedbackStore.getState().setScreenshot('data:image/png;base64,abc');
      useFeedbackStore.getState().clearDraftContent();
    });
    const { draft } = useFeedbackStore.getState();
    expect(draft.severity).toBeUndefined();
    expect(draft.priority).toBeUndefined();
    expect(draft.screenshot).toBeNull();
  });
});
