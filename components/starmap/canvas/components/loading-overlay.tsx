'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Spinner } from '@/components/common/spinner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { LoadingState } from '@/types/stellarium-canvas';

const SLOW_LOADING_THRESHOLD = 15;
const ELAPSED_SHOW_THRESHOLD = 3;

interface LoadingOverlayProps {
  loadingState: LoadingState;
  onRetry: () => void;
}

/**
 * Loading overlay component for Stellarium canvas
 * Shows loading spinner, progress bar, status message, and retry button on error
 */
export function LoadingOverlay({ loadingState, onRetry }: LoadingOverlayProps) {
  const t = useTranslations('canvas');
  const { isLoading, loadingStatus, errorMessage, startTime, progress, phase } = loadingState;
  const [elapsed, setElapsed] = useState(0);
  const [smoothProgress, setSmoothProgress] = useState(0);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isLoading || !startTime) {
      return;
    }
    const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      clearInterval(interval);
      setElapsed(0);
    };
  }, [isLoading, startTime]);

  // Smoothly animate progress towards the target value
  useEffect(() => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);

    const animate = () => {
      setSmoothProgress(prev => {
        const target = progress;
        if (prev >= target) return target;
        // Ease towards target: fast jump + slow approach
        const step = Math.max(0.5, (target - prev) * 0.15);
        const next = Math.min(prev + step, target);
        if (next < target) {
          animRef.current = requestAnimationFrame(animate);
        }
        return next;
      });
    };
    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [progress]);

  const showTerminalRetry = !isLoading && (phase === 'timed_out' || phase === 'failed');

  // Don't render if not loading and no terminal failure state
  if (!isLoading && !errorMessage && !showTerminalRetry) {
    return null;
  }

  const isSlow = isLoading && !errorMessage && elapsed >= SLOW_LOADING_THRESHOLD;
  const isFirstLoad = isLoading && !errorMessage && elapsed >= 5 && elapsed < SLOW_LOADING_THRESHOLD;

  return (
    <div
      data-testid="stellarium-loading-overlay"
      role={errorMessage ? 'alert' : 'status'}
      aria-live="polite"
      className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-10 px-4 text-center"
    >
      {isLoading && !errorMessage && (
        <Spinner className="h-8 w-8 text-primary mb-4" />
      )}

      {/* Progress bar */}
      {isLoading && !errorMessage && (
        <div className="w-48 sm:w-56 mb-3">
          <Progress
            value={Math.round(smoothProgress)}
            className="h-1.5 bg-muted/30"
          />
        </div>
      )}

      <p className="text-muted-foreground text-sm mb-2">{loadingStatus}</p>

      {isLoading && !errorMessage && elapsed >= ELAPSED_SHOW_THRESHOLD && (
        <p className="text-muted-foreground/60 text-xs mb-1 tabular-nums">
          {t('elapsedTime', { seconds: elapsed })}
        </p>
      )}
      {isFirstLoad && (
        <p className="text-muted-foreground/40 text-xs mt-1">{t('firstLoadHint')}</p>
      )}
      {isSlow && (
        <div className="mt-2 flex flex-col items-center gap-2">
          <p className="text-yellow-500/80 text-xs">{t('loadingSlowHint')}</p>
          <Button size="sm" onClick={onRetry}>
            {t('retry')}
          </Button>
        </div>
      )}
      {(errorMessage || showTerminalRetry) && (
        <>
          {errorMessage && (
            <p className="text-destructive text-xs mb-3">{errorMessage}</p>
          )}
          <Button size="sm" onClick={onRetry}>
            {t('retry')}
          </Button>
        </>
      )}
    </div>
  );
}
