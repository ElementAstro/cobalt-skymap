'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, SwitchCamera, Flashlight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCamera } from '@/lib/hooks/use-camera';
import { useARSessionStatus } from '@/lib/hooks/use-ar-session-status';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';
import { cn } from '@/lib/utils';

interface ARCameraBackgroundProps {
  enabled: boolean;
  className?: string;
}

export function ARCameraBackground({ enabled, className }: ARCameraBackgroundProps) {
  const t = useTranslations();
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useCamera({ facingMode: 'environment' });
  const arSession = useARSessionStatus({ enabled });
  const setCameraRuntime = useARRuntimeStore((state) => state.setCameraRuntime);
  const resetCameraRuntime = useARRuntimeStore((state) => state.resetCameraRuntime);

  // Start/stop camera based on enabled prop
  useEffect(() => {
    if (enabled) {
      void camera.start();
    } else {
      camera.stop();
    }
  }, [camera, enabled]);

  useEffect(() => {
    if (!enabled) {
      resetCameraRuntime();
      return;
    }
    setCameraRuntime({
      isSupported: camera.isSupported,
      isLoading: camera.isLoading,
      hasStream: Boolean(camera.stream),
      errorType: camera.errorType,
    });
  }, [
    camera.errorType,
    camera.isLoading,
    camera.isSupported,
    camera.stream,
    enabled,
    resetCameraRuntime,
    setCameraRuntime,
  ]);

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        camera.stop();
        return;
      }
      if (document.visibilityState === 'visible') {
        void camera.start();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [camera, enabled]);

  useEffect(() => () => {
    resetCameraRuntime();
  }, [resetCameraRuntime]);

  // Attach stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !camera.stream) return;
    video.srcObject = camera.stream;
  }, [camera.stream]);

  if (!enabled) return null;

  // Error state
  if (camera.error) {
    return (
      <div className={cn('absolute inset-0 z-0 flex items-center justify-center bg-black/90', className)}>
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="text-sm text-red-300">
            {camera.errorType === 'permission-denied'
              ? t('settings.arCameraPermission')
              : camera.errorType === 'not-supported'
                ? t('settings.arNotSupported')
                : t('settings.arCameraError')}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void camera.start()}
          >
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('absolute inset-0 z-0', className)}>
      <video
        ref={videoRef}
        className={cn(
          'w-full h-full object-cover',
          camera.facingMode === 'user' && 'scale-x-[-1]'
        )}
        autoPlay
        playsInline
        muted
        aria-label="AR camera background"
      />

      {arSession.status !== 'ready' && (
        <div className="absolute left-2 top-2 z-10 rounded-md bg-black/40 px-2 py-1 text-[10px] text-white/90 backdrop-blur-sm">
          {arSession.status === 'preflight'
            ? t('settings.arStatusPreflight')
            : arSession.status === 'degraded-camera-only'
              ? t('settings.arStatusDegradedCameraOnly')
              : arSession.status === 'degraded-sensor-only'
                ? t('settings.arStatusDegradedSensorOnly')
                : t('settings.arStatusBlocked')}
        </div>
      )}

      {/* Camera controls overlay */}
      {camera.stream && (
        <div
          className="absolute flex flex-col gap-1.5 z-10"
          style={{
            top: 'calc(3.5rem + var(--safe-area-top))',
            right: 'calc(0.5rem + var(--safe-area-right))',
          }}
        >
          {camera.hasMultipleCameras && (
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full bg-background/40 backdrop-blur-sm hover:bg-background/60"
              onClick={() => void camera.switchCamera()}
              aria-label={t('common.switchCamera') ?? 'Switch camera'}
            >
              <SwitchCamera className="h-4 w-4" />
            </Button>
          )}
          {camera.capabilities.torch && (
            <Button
              variant={camera.torchOn ? 'default' : 'secondary'}
              size="icon"
              className="h-8 w-8 rounded-full bg-background/40 backdrop-blur-sm hover:bg-background/60"
              onClick={() => void camera.toggleTorch()}
              aria-label="Torch"
            >
              <Flashlight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Loading state */}
      {camera.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="flex flex-col items-center gap-2">
            <Camera className="h-8 w-8 text-muted-foreground animate-pulse" />
            <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
