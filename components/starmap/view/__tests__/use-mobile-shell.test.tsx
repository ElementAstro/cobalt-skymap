/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useMobileShell } from '../use-mobile-shell';

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: height });
}

describe('useMobileShell', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'visualViewport');
  });

  it('detects phone viewport as mobile shell', () => {
    setViewport(390, 844);
    const { result } = renderHook(() => useMobileShell());

    expect(result.current.isMobileShell).toBe(true);
    expect(result.current.isLandscape).toBe(false);
  });

  it('detects desktop viewport as non-mobile shell', () => {
    setViewport(1366, 768);
    const { result } = renderHook(() => useMobileShell());

    expect(result.current.isMobileShell).toBe(false);
    expect(result.current.isLandscape).toBe(true);
  });

  it('recomputes state after viewport resize', () => {
    setViewport(1366, 768);
    const { result } = renderHook(() => useMobileShell());
    expect(result.current.isMobileShell).toBe(false);

    act(() => {
      setViewport(768, 1024);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.isMobileShell).toBe(true);
    expect(result.current.isLandscape).toBe(false);
  });

  it('recomputes state after visual viewport resize', () => {
    const listeners = new Map<string, Set<EventListener>>();
    const visualViewport = {
      width: 390,
      height: 844,
      addEventListener: (type: string, listener: EventListener) => {
        const setForType = listeners.get(type) ?? new Set<EventListener>();
        setForType.add(listener);
        listeners.set(type, setForType);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        listeners.get(type)?.delete(listener);
      },
      dispatchResize: () => {
        const event = new Event('resize');
        listeners.get('resize')?.forEach((listener) => listener(event));
      },
    };

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: visualViewport,
    });
    setViewport(390, 844);
    const { result } = renderHook(() => useMobileShell());
    expect(result.current.viewportHeight).toBe(844);

    act(() => {
      visualViewport.height = 720;
      visualViewport.dispatchResize();
    });

    expect(result.current.viewportHeight).toBe(720);
    expect(result.current.isMobileShell).toBe(true);
  });
});
