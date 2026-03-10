/**
 * Tests for plate-solving/solve-utils.ts
 * Progress formatting utilities and file persistence
 */

import { getProgressText, getProgressPercent, persistFileForLocalSolve } from '../solve-utils';
import type { SolveProgress } from '../astrometry-api';
import { createInitialOnlineSolveSessionState } from '../online-solve-contract';
import type { PlateSolveResult } from '../types';

const mockT = (key: string) => key;

// ============================================================================
// persistFileForLocalSolve
// ============================================================================

jest.mock('@tauri-apps/plugin-fs', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  remove: jest.fn(),
  BaseDirectory: { AppCache: 'AppCache' },
}), { virtual: true });

jest.mock('@tauri-apps/api/path', () => ({
  BaseDirectory: { AppCache: 'AppCache' },
  appCacheDir: jest.fn(() => Promise.resolve('/mock/cache')),
  join: jest.fn((...parts: string[]) => Promise.resolve(parts.join('/'))),
}), { virtual: true });

describe('persistFileForLocalSolve', () => {
  it('should return native file path directly when available', async () => {
    const file = new File(['data'], 'test.fits') as File & { path?: string };
    (file as unknown as Record<string, unknown>).path = '/native/path/test.fits';

    const result = await persistFileForLocalSolve(file);
    expect(result.filePath).toBe('/native/path/test.fits');
    expect(result.cleanup).toBeUndefined();
  });

  it('should write file to AppCache and return cleanup when no native path', async () => {
    const file = new File(['pixel-data'], 'astro image!.fits');
    // jsdom File doesn't implement arrayBuffer(), so mock it
    if (!file.arrayBuffer) {
      (file as unknown as Record<string, unknown>).arrayBuffer = () =>
        Promise.resolve(new TextEncoder().encode('pixel-data').buffer);
    }

    const result = await persistFileForLocalSolve(file);
    expect(result.filePath).toContain('/mock/cache');
    expect(result.filePath).toContain('plate-solving');
    expect(result.cleanup).toBeDefined();

    // Cleanup should call remove
    const { remove } = await import('@tauri-apps/plugin-fs');
    await result.cleanup!();
    expect(remove).toHaveBeenCalled();
  });
});

// ============================================================================
// getProgressText
// ============================================================================

describe('getProgressText', () => {
  it('should return empty string when progress is null', () => {
    const text = getProgressText(null, mockT);
    expect(text).toBe('');
  });

  it('should return text for uploading stage', () => {
    const p: SolveProgress = { stage: 'uploading', progress: 50 };
    const text = getProgressText(p, mockT);
    expect(text).toContain('50');
  });

  it('should return text for queued stage', () => {
    const p: SolveProgress = { stage: 'queued', subid: 12345 };
    const text = getProgressText(p, mockT);
    expect(text).toContain('12345');
  });

  it('should return text for processing stage', () => {
    const p: SolveProgress = { stage: 'processing', jobId: 9999 };
    const text = getProgressText(p, mockT);
    expect(text).toContain('9999');
  });

  it('should return text for success stage', () => {
    const p: SolveProgress = { stage: 'success', result: {} as PlateSolveResult };
    const text = getProgressText(p, mockT);
    expect(text).toBeDefined();
  });

  it('should return text for failed stage', () => {
    const p: SolveProgress = { stage: 'failed', error: 'Timeout' };
    const text = getProgressText(p, mockT);
    expect(text).toContain('Timeout');
  });

  it('should use fallback text when translation key returns empty', () => {
    const emptyT = () => '';
    const p: SolveProgress = { stage: 'uploading', progress: 10 };
    const text = getProgressText(p, emptyT);
    expect(text).toContain('Uploading');
  });

  it('should support normalized session stages', () => {
    const session = {
      ...createInitialOnlineSolveSessionState('tauri'),
      stage: 'authenticating' as const,
      progress: 10,
    };
    const text = getProgressText(session, mockT);
    expect(text).toContain('authenticating');
  });
});

// ============================================================================
// getProgressPercent
// ============================================================================

describe('getProgressPercent', () => {
  it('should return 0 when online progress is null', () => {
    expect(getProgressPercent('online', 0, null)).toBe(0);
  });

  it('should return localProgress for local mode', () => {
    expect(getProgressPercent('local', 75, null)).toBe(75);
  });

  it('should return uploading progress * 0.3', () => {
    const p: SolveProgress = { stage: 'uploading', progress: 50 };
    expect(getProgressPercent('online', 0, p)).toBe(15);
  });

  it('should return 30 for queued stage', () => {
    const p: SolveProgress = { stage: 'queued', subid: 1 };
    expect(getProgressPercent('online', 0, p)).toBe(30);
  });

  it('should return 60 for processing stage', () => {
    const p: SolveProgress = { stage: 'processing', jobId: 1 };
    expect(getProgressPercent('online', 0, p)).toBe(60);
  });

  it('should return 100 for success stage', () => {
    const p: SolveProgress = { stage: 'success', result: {} as PlateSolveResult };
    expect(getProgressPercent('online', 0, p)).toBe(100);
  });

  it('should return 100 for failed stage', () => {
    const p: SolveProgress = { stage: 'failed', error: 'err' };
    expect(getProgressPercent('online', 0, p)).toBe(100);
  });

  it('should return normalized progress for session state', () => {
    const session = {
      ...createInitialOnlineSolveSessionState('web'),
      stage: 'queued' as const,
      progress: 42,
    };
    expect(getProgressPercent('online', 0, session)).toBe(42);
  });
});
