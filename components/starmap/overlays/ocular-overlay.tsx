'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { OcularOverlayProps } from '@/types/starmap/overlays';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function OcularOverlay({
  enabled,
  tfov,
  currentFov,
  opacity,
  showCrosshair = true,
}: OcularOverlayProps) {
  const t = useTranslations('ocular');

  const metrics = useMemo(() => {
    if (!enabled || !Number.isFinite(currentFov) || currentFov <= 0 || !Number.isFinite(tfov) || (tfov ?? 0) <= 0) {
      return null;
    }

    const safeCurrentFov = Math.max(currentFov, 0.01);
    const safeTfov = Math.max(tfov ?? 0, 0.01);
    const ratio = safeTfov / safeCurrentFov;

    return {
      ratio,
      exceedsCurrentFov: ratio > 1,
      diameterPercent: clamp(ratio * 100, 8, 100),
      overlayAlpha: clamp(opacity, 0, 100) / 100,
    };
  }, [currentFov, enabled, opacity, tfov]);

  if (!metrics) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-[13] flex items-center justify-center" data-testid="ocular-overlay">
      {metrics.exceedsCurrentFov && (
        <div
          data-testid="ocular-overlay-warning"
          className="absolute left-1/2 -translate-x-1/2 rounded bg-black/70 px-2 py-1 text-[10px] text-yellow-300 border border-yellow-600/50"
          style={{ top: 'calc(0.75rem + var(--safe-area-top))' }}
        >
          {t('overlayExceedsFov')}
        </div>
      )}

      <div
        data-testid="ocular-overlay-circle"
        className="relative rounded-full border border-white/70 shadow-[0_0_16px_rgba(0,0,0,0.35)]"
        style={{
          width: `${metrics.diameterPercent}%`,
          height: `${metrics.diameterPercent}%`,
          boxShadow: `0 0 0 9999px rgba(0, 0, 0, ${metrics.overlayAlpha})`,
        }}
      >
        {showCrosshair && (
          <>
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/40" />
            <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-white/40" />
          </>
        )}
      </div>
    </div>
  );
}
