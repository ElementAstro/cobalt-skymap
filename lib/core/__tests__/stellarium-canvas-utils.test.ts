/**
 * Tests for stellarium-canvas-utils.ts
 * FOV conversion and timeout utilities
 */

import { withTimeout, fovToRad, fovToDeg, getMaxDprForQuality, getEffectiveDpr, prefetchWasm } from '../stellarium-canvas-utils';

describe('getMaxDprForQuality', () => {
  it('should return 1 for low quality', () => {
    expect(getMaxDprForQuality('low')).toBe(1);
  });

  it('should return 1.5 for medium quality', () => {
    expect(getMaxDprForQuality('medium')).toBe(1.5);
  });

  it('should return 2 for high quality', () => {
    expect(getMaxDprForQuality('high')).toBe(2);
  });

  it('should return Infinity for ultra quality (no cap)', () => {
    expect(getMaxDprForQuality('ultra')).toBe(Infinity);
  });

  it('should return Infinity for unknown quality', () => {
    expect(getMaxDprForQuality('unknown')).toBe(Infinity);
  });
});

describe('getEffectiveDpr', () => {
  const originalDpr = window.devicePixelRatio;

  afterEach(() => {
    Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, writable: true });
  });

  it('should cap DPR at 1 for low quality on high-DPR display', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, writable: true });
    expect(getEffectiveDpr('low')).toBe(1);
  });

  it('should not cap DPR for ultra quality', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, writable: true });
    expect(getEffectiveDpr('ultra')).toBe(3);
  });

  it('should use native DPR when below cap', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 1.25, writable: true });
    expect(getEffectiveDpr('high')).toBe(1.25);
  });

  it('should default to 1 when devicePixelRatio is falsy', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 0, writable: true });
    expect(getEffectiveDpr('ultra')).toBe(1);
  });
});

describe('fovToRad', () => {
  it('should convert 0 degrees to 0 radians', () => {
    expect(fovToRad(0)).toBe(0);
  });

  it('should convert 180 degrees to PI radians', () => {
    expect(fovToRad(180)).toBeCloseTo(Math.PI);
  });

  it('should convert 90 degrees to PI/2 radians', () => {
    expect(fovToRad(90)).toBeCloseTo(Math.PI / 2);
  });
});

describe('fovToDeg', () => {
  it('should convert 0 radians to 0 degrees', () => {
    expect(fovToDeg(0)).toBe(0);
  });

  it('should convert PI radians to 180 degrees', () => {
    expect(fovToDeg(Math.PI)).toBeCloseTo(180);
  });

  it('should be inverse of fovToRad', () => {
    for (const deg of [0, 45, 90, 180, 360]) {
      expect(fovToDeg(fovToRad(deg))).toBeCloseTo(deg);
    }
  });
});

describe('withTimeout', () => {
  it('should resolve when promise resolves before timeout', async () => {
    const result = await withTimeout(
      Promise.resolve('ok'),
      1000,
      'timed out'
    );
    expect(result).toBe('ok');
  });

  it('should reject when promise takes longer than timeout', async () => {
    const slowPromise = new Promise((resolve) => setTimeout(resolve, 5000));
    await expect(
      withTimeout(slowPromise, 10, 'timed out')
    ).rejects.toThrow('timed out');
  });

  it('should reject with timeout message', async () => {
    const slowPromise = new Promise(() => {}); // never resolves
    await expect(
      withTimeout(slowPromise, 10, 'custom timeout message')
    ).rejects.toThrow('custom timeout message');
  });

  it('should propagate rejection from original promise', async () => {
    const failPromise = Promise.reject(new Error('original error'));
    await expect(
      withTimeout(failPromise, 5000, 'timed out')
    ).rejects.toThrow('original error');
  });
});

describe('prefetchWasm', () => {
  const originalFetch = global.fetch;
  const originalWindowFetch = (window as Window & { __originalFetch?: typeof fetch }).__originalFetch;

  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as Window & { __originalFetch?: typeof fetch }).__originalFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    if (originalWindowFetch) {
      (window as Window & { __originalFetch?: typeof fetch }).__originalFetch = originalWindowFetch;
    } else {
      delete (window as Window & { __originalFetch?: typeof fetch }).__originalFetch;
    }
  });

  it('should return true when fetch succeeds', async () => {
    const fallbackFetch = jest.fn().mockResolvedValue({ ok: false });
    const originalFetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fallbackFetch as unknown as typeof fetch;
    (window as Window & { __originalFetch?: typeof fetch }).__originalFetch = originalFetchMock as unknown as typeof fetch;

    const result = await prefetchWasm();

    expect(result).toBe(true);
    expect(originalFetchMock).toHaveBeenCalled();
    expect(fallbackFetch).not.toHaveBeenCalled();
  });

  it('should return false when fetch fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch;

    const result = await prefetchWasm();

    expect(result).toBe(false);
  });

  it('should return false when response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    const result = await prefetchWasm();

    expect(result).toBe(false);
  });
});
