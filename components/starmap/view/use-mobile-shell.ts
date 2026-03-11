'use client';

import { useMemo, useSyncExternalStore } from 'react';

const MOBILE_SHELL_MAX_WIDTH = 900;
const MOBILE_SHELL_LANDSCAPE_MAX_WIDTH = 1200;
const MOBILE_SHELL_LANDSCAPE_MAX_HEIGHT = 640;
const FALLBACK_VIEWPORT_WIDTH = 1024;
const FALLBACK_VIEWPORT_HEIGHT = 768;

export interface MobileShellState {
  isMobileShell: boolean;
  isLandscape: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

function getViewportKeyFromWindow() {
  const visualViewport = window.visualViewport;
  const width = visualViewport?.width ?? window.innerWidth;
  const height = visualViewport?.height ?? window.innerHeight;

  return `${Math.round(width)}x${Math.round(height)}`;
}

function getServerViewportKey() {
  return `${FALLBACK_VIEWPORT_WIDTH}x${FALLBACK_VIEWPORT_HEIGHT}`;
}

function isMobileShellViewport(width: number, height: number) {
  return width <= MOBILE_SHELL_MAX_WIDTH || (
    width > height &&
    width <= MOBILE_SHELL_LANDSCAPE_MAX_WIDTH &&
    height <= MOBILE_SHELL_LANDSCAPE_MAX_HEIGHT
  );
}

export function useMobileShell(): MobileShellState {
  const viewportKey = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => {};

      const handleResize = () => {
        onStoreChange();
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', handleResize);
      window.visualViewport?.addEventListener('resize', handleResize);
      window.visualViewport?.addEventListener('scroll', handleResize);
      const bootstrapTimer = window.setTimeout(onStoreChange, 0);

      return () => {
        window.clearTimeout(bootstrapTimer);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
        window.visualViewport?.removeEventListener('resize', handleResize);
        window.visualViewport?.removeEventListener('scroll', handleResize);
      };
    },
    () => {
      if (typeof window === 'undefined') return getServerViewportKey();
      return getViewportKeyFromWindow();
    },
    getServerViewportKey,
  );

  return useMemo(() => {
    const [viewportWidthRaw, viewportHeightRaw] = viewportKey.split('x');
    const viewportWidth = Number(viewportWidthRaw) || FALLBACK_VIEWPORT_WIDTH;
    const viewportHeight = Number(viewportHeightRaw) || FALLBACK_VIEWPORT_HEIGHT;

    return {
      viewportWidth,
      viewportHeight,
      isLandscape: viewportWidth > viewportHeight,
      isMobileShell: isMobileShellViewport(viewportWidth, viewportHeight),
    };
  }, [viewportKey]);
}
