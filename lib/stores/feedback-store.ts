'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getZustandStorage } from '@/lib/storage';
import type { FeedbackDraft, FeedbackType, FeedbackSeverity, FeedbackPriority } from '@/types/feedback';

interface FeedbackPreferences {
  includeSystemInfo: boolean;
  includeLogs: boolean;
}

interface FeedbackStoreState {
  draft: FeedbackDraft;
  preferences: FeedbackPreferences;
  setType: (type: FeedbackType) => void;
  updateDraft: (patch: Partial<FeedbackDraft>) => void;
  setIncludeSystemInfo: (enabled: boolean) => void;
  setIncludeLogs: (enabled: boolean) => void;
  setSeverity: (severity: FeedbackSeverity | undefined) => void;
  setPriority: (priority: FeedbackPriority | undefined) => void;
  setScreenshot: (screenshot: string | null) => void;
  resetDraft: (type?: FeedbackType) => void;
  clearDraftContent: () => void;
}

const DEFAULT_PREFERENCES: FeedbackPreferences = {
  includeSystemInfo: false,
  includeLogs: false,
};

const createDefaultDraft = (
  type: FeedbackType = 'bug',
  preferences: FeedbackPreferences = DEFAULT_PREFERENCES
): FeedbackDraft => ({
  type,
  title: '',
  description: '',
  reproductionSteps: '',
  expectedBehavior: '',
  additionalContext: '',
  includeSystemInfo: preferences.includeSystemInfo,
  includeLogs: preferences.includeLogs,
});

export const useFeedbackStore = create<FeedbackStoreState>()(
  persist(
    (set, get) => ({
      draft: createDefaultDraft(),
      preferences: DEFAULT_PREFERENCES,

      setType: (type) => {
        set((state) => ({ draft: { ...state.draft, type } }));
      },

      updateDraft: (patch) => {
        set((state) => ({ draft: { ...state.draft, ...patch } }));
      },

      setIncludeSystemInfo: (enabled) => {
        set((state) => ({
          preferences: { ...state.preferences, includeSystemInfo: enabled },
          draft: { ...state.draft, includeSystemInfo: enabled },
        }));
      },

      setIncludeLogs: (enabled) => {
        set((state) => ({
          preferences: { ...state.preferences, includeLogs: enabled },
          draft: { ...state.draft, includeLogs: enabled },
        }));
      },

      setSeverity: (severity) => {
        set((state) => ({ draft: { ...state.draft, severity } }));
      },

      setPriority: (priority) => {
        set((state) => ({ draft: { ...state.draft, priority } }));
      },

      setScreenshot: (screenshot) => {
        set((state) => ({ draft: { ...state.draft, screenshot } }));
      },

      resetDraft: (type) => {
        const { preferences, draft } = get();
        set({
          draft: createDefaultDraft(type ?? draft.type, preferences),
        });
      },

      clearDraftContent: () => {
        set((state) => ({
          draft: {
            ...state.draft,
            title: '',
            description: '',
            reproductionSteps: '',
            expectedBehavior: '',
            additionalContext: '',
            severity: undefined,
            priority: undefined,
            screenshot: null,
          },
        }));
      },
    }),
    {
      name: 'starmap-feedback',
      storage: getZustandStorage(),
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as Partial<FeedbackStoreState> | undefined;
        const preferences = {
          ...DEFAULT_PREFERENCES,
          ...state?.preferences,
        };
        const draft = state?.draft
          ? {
              ...createDefaultDraft(state.draft.type ?? 'bug', preferences),
              ...state.draft,
              includeSystemInfo:
                typeof state.draft.includeSystemInfo === 'boolean'
                  ? state.draft.includeSystemInfo
                  : preferences.includeSystemInfo,
              includeLogs:
                typeof state.draft.includeLogs === 'boolean'
                  ? state.draft.includeLogs
                  : preferences.includeLogs,
            }
          : createDefaultDraft('bug', preferences);
        return { draft, preferences };
      },
      partialize: (state) => ({
        draft: state.draft,
        preferences: state.preferences,
      }),
    }
  )
);

