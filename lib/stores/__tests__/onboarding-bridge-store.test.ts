/**
 * Tests for onboarding-bridge-store.ts
 * Request-ID-based bridge for onboarding interactions
 */

import { act } from '@testing-library/react';
import { useOnboardingBridgeStore } from '../onboarding-bridge-store';

beforeEach(() => {
  act(() => {
    useOnboardingBridgeStore.setState({
      expandRightPanelRequestId: 0,
      openSettingsDrawerRequestId: 0,
      settingsDrawerTab: null,
      settingsDrawerOpen: false,
      openSearchRequestId: 0,
      openMobileDrawerRequestId: 0,
      openDailyKnowledgeRequestId: 0,
      mobileDrawerSection: null,
      closeTransientPanelsRequestId: 0,
    });
  });
});

describe('useOnboardingBridgeStore', () => {
  it('should increment expandRightPanelRequestId', () => {
    act(() => {
      useOnboardingBridgeStore.getState().expandRightPanel();
    });
    expect(useOnboardingBridgeStore.getState().expandRightPanelRequestId).toBe(1);
  });

  it('should increment openSettingsDrawerRequestId and set tab', () => {
    act(() => {
      useOnboardingBridgeStore.getState().openSettingsDrawer('display');
    });
    expect(useOnboardingBridgeStore.getState().openSettingsDrawerRequestId).toBe(1);
    expect(useOnboardingBridgeStore.getState().settingsDrawerTab).toBe('display');
    expect(useOnboardingBridgeStore.getState().settingsDrawerOpen).toBe(true);
  });

  it('should default settingsDrawerTab to null', () => {
    act(() => {
      useOnboardingBridgeStore.getState().openSettingsDrawer();
    });
    expect(useOnboardingBridgeStore.getState().settingsDrawerTab).toBeNull();
  });

  it('should set settings drawer open state directly', () => {
    act(() => {
      useOnboardingBridgeStore.getState().setSettingsDrawerOpen(true);
    });
    expect(useOnboardingBridgeStore.getState().settingsDrawerOpen).toBe(true);

    act(() => {
      useOnboardingBridgeStore.getState().setSettingsDrawerOpen(false);
    });
    expect(useOnboardingBridgeStore.getState().settingsDrawerOpen).toBe(false);
  });

  it('should increment openSearchRequestId', () => {
    act(() => {
      useOnboardingBridgeStore.getState().openSearch();
    });
    expect(useOnboardingBridgeStore.getState().openSearchRequestId).toBe(1);
  });

  it('should increment openMobileDrawerRequestId and set section', () => {
    act(() => {
      useOnboardingBridgeStore.getState().openMobileDrawer('targets');
    });
    expect(useOnboardingBridgeStore.getState().openMobileDrawerRequestId).toBe(1);
    expect(useOnboardingBridgeStore.getState().mobileDrawerSection).toBe('targets');
  });

  it('should increment openDailyKnowledgeRequestId', () => {
    act(() => {
      useOnboardingBridgeStore.getState().openDailyKnowledge();
    });
    expect(useOnboardingBridgeStore.getState().openDailyKnowledgeRequestId).toBe(1);
  });

  it('should increment closeTransientPanelsRequestId', () => {
    act(() => {
      useOnboardingBridgeStore.getState().closeTransientPanels();
    });
    expect(useOnboardingBridgeStore.getState().closeTransientPanelsRequestId).toBe(1);
  });
});
