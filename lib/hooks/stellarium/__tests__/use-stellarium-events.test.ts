/**
 * Tests for use-stellarium-events.ts
 * Right-click context menu and long press event handling
 */

import { renderHook } from '@testing-library/react';
import { useStellariumEvents } from '../use-stellarium-events';
import { useRef } from 'react';

describe('useStellariumEvents', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should not throw when containerRef is null', () => {
    expect(() => {
      renderHook(() => {
        const containerRef = useRef<HTMLDivElement | null>(null);
        useStellariumEvents({
          containerRef,
          getClickCoordinates: () => null,
        });
      });
    }).not.toThrow();
  });

  it('should attach event listeners when container exists', () => {
    const container = document.createElement('div');
    const addSpy = jest.spyOn(container, 'addEventListener');

    renderHook(() => {
      const containerRef = useRef<HTMLDivElement | null>(container);
      useStellariumEvents({
        containerRef,
        getClickCoordinates: () => null,
      });
    });

    // Should have attached mousedown and other event listeners
    expect(addSpy).toHaveBeenCalled();
    addSpy.mockRestore();
  });

  it('triggers context menu callback for canvas right-click', () => {
    const container = document.createElement('div');
    const callback = jest.fn();
    renderHook(() => {
      const containerRef = useRef<HTMLDivElement | null>(container);
      useStellariumEvents({
        containerRef,
        getClickCoordinates: () => ({ ra: 1, dec: 2, raStr: '00h', decStr: '+00d' }),
        onContextMenu: callback,
      });
    });

    container.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true, clientX: 120, clientY: 240 }));
    container.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 120, clientY: 240 }));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not trigger context menu callback for UI controls', () => {
    const container = document.createElement('div');
    const uiButton = document.createElement('button');
    uiButton.setAttribute('data-starmap-ui-control', 'true');
    container.appendChild(uiButton);

    const callback = jest.fn();
    renderHook(() => {
      const containerRef = useRef<HTMLDivElement | null>(container);
      useStellariumEvents({
        containerRef,
        getClickCoordinates: () => ({ ra: 1, dec: 2, raStr: '00h', decStr: '+00d' }),
        onContextMenu: callback,
      });
    });

    uiButton.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true, clientX: 80, clientY: 80 }));
    uiButton.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 80, clientY: 80 }));

    expect(callback).not.toHaveBeenCalled();
  });

  it('does not trigger long-press context menu when touch starts on UI control', () => {
    const container = document.createElement('div');
    const uiButton = document.createElement('button');
    uiButton.setAttribute('data-starmap-ui-control', 'true');
    container.appendChild(uiButton);

    const callback = jest.fn();
    renderHook(() => {
      const containerRef = useRef<HTMLDivElement | null>(container);
      useStellariumEvents({
        containerRef,
        getClickCoordinates: () => ({ ra: 1, dec: 2, raStr: '00h', decStr: '+00d' }),
        onContextMenu: callback,
      });
    });

    const startEvent = new Event('touchstart', { bubbles: true, cancelable: true }) as TouchEvent;
    Object.defineProperty(startEvent, 'touches', {
      value: [{ clientX: 64, clientY: 96 }],
      configurable: true,
    });
    uiButton.dispatchEvent(startEvent);
    jest.advanceTimersByTime(1000);

    expect(callback).not.toHaveBeenCalled();
  });
});
