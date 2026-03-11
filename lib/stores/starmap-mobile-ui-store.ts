import { create } from 'zustand';

export type StarmapMobilePanelId = 'search' | 'details' | 'planning' | 'settings';

interface MobilePanelTransitionOptions {
  preservePrevious?: boolean;
}

interface StarmapMobileUiState {
  isMobileShell: boolean;
  activePanel: StarmapMobilePanelId | null;
  previousPanel: StarmapMobilePanelId | null;
  setMobileShell: (isMobileShell: boolean) => void;
  openPanel: (panel: StarmapMobilePanelId, options?: MobilePanelTransitionOptions) => void;
  closePanel: (options?: MobilePanelTransitionOptions) => void;
  closePanelIfActive: (panel: StarmapMobilePanelId, options?: MobilePanelTransitionOptions) => void;
  resetPanelFlow: () => void;
}

export const useStarmapMobileUiStore = create<StarmapMobileUiState>((set, get) => ({
  isMobileShell: false,
  activePanel: null,
  previousPanel: null,
  setMobileShell: (isMobileShell) =>
    set((state) => {
      if (state.isMobileShell === isMobileShell) {
        return state;
      }

      return {
        isMobileShell,
        activePanel: isMobileShell ? state.activePanel : null,
        previousPanel: isMobileShell ? state.previousPanel : null,
      };
    }),
  openPanel: (panel, options) =>
    set((state) => {
      const preservePrevious = options?.preservePrevious ?? true;
      if (state.activePanel === panel) {
        return {
          activePanel: panel,
          previousPanel: state.previousPanel === panel ? null : state.previousPanel,
        };
      }

      const shouldUpdatePrevious = preservePrevious && state.activePanel !== null;
      return {
        activePanel: panel,
        previousPanel: shouldUpdatePrevious ? state.activePanel : null,
      };
    }),
  closePanel: (options) =>
    set((state) => {
      const preservePrevious = options?.preservePrevious ?? true;
      if (preservePrevious && state.previousPanel && state.previousPanel !== state.activePanel) {
        return {
          activePanel: state.previousPanel,
          previousPanel: null,
        };
      }

      return {
        activePanel: null,
        previousPanel: null,
      };
    }),
  closePanelIfActive: (panel, options) => {
    if (get().activePanel === panel) {
      get().closePanel(options);
    }
  },
  resetPanelFlow: () => set({ activePanel: null, previousPanel: null }),
}));
