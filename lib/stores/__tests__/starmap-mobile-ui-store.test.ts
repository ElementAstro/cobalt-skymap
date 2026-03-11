import { act } from '@testing-library/react';
import { useStarmapMobileUiStore } from '../starmap-mobile-ui-store';

function resetStore() {
  useStarmapMobileUiStore.setState({
    isMobileShell: false,
    activePanel: null,
    previousPanel: null,
  });
}

describe('useStarmapMobileUiStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('starts with desktop state and no active panel', () => {
    const state = useStarmapMobileUiStore.getState();
    expect(state.isMobileShell).toBe(false);
    expect(state.activePanel).toBeNull();
    expect(state.previousPanel).toBeNull();
  });

  it('opens one panel at a time', () => {
    act(() => {
      useStarmapMobileUiStore.getState().openPanel('search');
    });
    expect(useStarmapMobileUiStore.getState().activePanel).toBe('search');

    act(() => {
      useStarmapMobileUiStore.getState().openPanel('details');
    });
    expect(useStarmapMobileUiStore.getState().activePanel).toBe('details');
    expect(useStarmapMobileUiStore.getState().previousPanel).toBe('search');
  });

  it('closes panel when active match is requested', () => {
    act(() => {
      useStarmapMobileUiStore.getState().openPanel('planning');
    });
    expect(useStarmapMobileUiStore.getState().activePanel).toBe('planning');

    act(() => {
      useStarmapMobileUiStore.getState().closePanelIfActive('search');
    });
    expect(useStarmapMobileUiStore.getState().activePanel).toBe('planning');

    act(() => {
      useStarmapMobileUiStore.getState().closePanelIfActive('planning');
    });
    expect(useStarmapMobileUiStore.getState().activePanel).toBeNull();
    expect(useStarmapMobileUiStore.getState().previousPanel).toBeNull();
  });

  it('resets active panel when leaving mobile shell', () => {
    act(() => {
      useStarmapMobileUiStore.getState().setMobileShell(true);
      useStarmapMobileUiStore.getState().openPanel('settings');
    });
    expect(useStarmapMobileUiStore.getState().activePanel).toBe('settings');

    act(() => {
      useStarmapMobileUiStore.getState().setMobileShell(false);
    });
    const state = useStarmapMobileUiStore.getState();
    expect(state.isMobileShell).toBe(false);
    expect(state.activePanel).toBeNull();
    expect(state.previousPanel).toBeNull();
  });

  it('restores previous panel when closing active panel with preservePrevious', () => {
    act(() => {
      const store = useStarmapMobileUiStore.getState();
      store.openPanel('details');
      store.openPanel('planning');
    });

    expect(useStarmapMobileUiStore.getState().activePanel).toBe('planning');
    expect(useStarmapMobileUiStore.getState().previousPanel).toBe('details');

    act(() => {
      useStarmapMobileUiStore.getState().closePanelIfActive('planning');
    });

    expect(useStarmapMobileUiStore.getState().activePanel).toBe('details');
    expect(useStarmapMobileUiStore.getState().previousPanel).toBeNull();
  });

  it('can close active panel without restoring previous context', () => {
    act(() => {
      const store = useStarmapMobileUiStore.getState();
      store.openPanel('search');
      store.openPanel('settings');
      store.closePanel({ preservePrevious: false });
    });

    expect(useStarmapMobileUiStore.getState().activePanel).toBeNull();
    expect(useStarmapMobileUiStore.getState().previousPanel).toBeNull();
  });

  it('clears stale previous panel when opening with preservePrevious disabled', () => {
    act(() => {
      const store = useStarmapMobileUiStore.getState();
      store.openPanel('search');
      store.openPanel('details');
      store.openPanel('settings', { preservePrevious: false });
    });

    const state = useStarmapMobileUiStore.getState();
    expect(state.activePanel).toBe('settings');
    expect(state.previousPanel).toBeNull();
  });

  it('normalizes previous panel when opening the same panel repeatedly', () => {
    act(() => {
      const store = useStarmapMobileUiStore.getState();
      store.openPanel('search');
      store.openPanel('details');
      store.openPanel('details');
    });

    const state = useStarmapMobileUiStore.getState();
    expect(state.activePanel).toBe('details');
    expect(state.previousPanel).toBe('search');
  });
});
