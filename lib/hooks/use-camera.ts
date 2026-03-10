'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export type FacingMode = 'user' | 'environment';

export type CameraErrorType =
  | 'not-supported'
  | 'not-found'
  | 'permission-denied'
  | 'in-use'
  | 'unknown';

export interface CameraDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

export interface CameraCapabilities {
  zoom?: { min: number; max: number; step: number };
  torch?: boolean;
}

export interface CameraResolution {
  label: string;
  width: number;
  height: number;
}

export const CAMERA_RESOLUTIONS: CameraResolution[] = [
  { label: '720p', width: 1280, height: 720 },
  { label: '1080p', width: 1920, height: 1080 },
  { label: 'Max', width: 4096, height: 2160 },
];

export interface UseCameraOptions {
  facingMode?: FacingMode;
  resolution?: CameraResolution;
  autoStart?: boolean;
}

export interface UseCameraReturn {
  // State
  stream: MediaStream | null;
  isLoading: boolean;
  error: string | null;
  errorType: CameraErrorType | null;
  facingMode: FacingMode;
  devices: CameraDevice[];
  capabilities: CameraCapabilities;
  isSupported: boolean;
  hasMultipleCameras: boolean;
  zoomLevel: number;
  torchOn: boolean;

  // Actions
  start: (constraints?: Partial<UseCameraOptions>) => Promise<void>;
  stop: () => void;
  switchCamera: () => Promise<void>;
  setFacingMode: (mode: FacingMode) => Promise<void>;
  capture: (
    videoRef: React.RefObject<HTMLVideoElement | null>,
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    quality?: number,
  ) => { file: File; dataUrl: string; width: number; height: number } | null;
  setZoom: (level: number) => Promise<void>;
  toggleTorch: () => Promise<void>;
  enumerateDevices: () => Promise<void>;
}

// ============================================================================
// Error Classification
// ============================================================================

function classifyError(error: unknown): { message: string; type: CameraErrorType } {
  if (error instanceof Error) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return { message: error.message, type: 'permission-denied' };
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return { message: error.message, type: 'not-found' };
      case 'NotReadableError':
      case 'TrackStartError':
      case 'AbortError':
        return { message: error.message, type: 'in-use' };
      default:
        return { message: error.message, type: 'unknown' };
    }
  }
  return { message: 'Unknown camera error', type: 'unknown' };
}

// ============================================================================
// Hook
// ============================================================================

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const {
    facingMode: initialFacingMode = 'environment',
    resolution: initialResolution,
  } = options;

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<CameraErrorType | null>(null);
  const [facingMode, setFacingModeState] = useState<FacingMode>(initialFacingMode);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [capabilities, setCapabilities] = useState<CameraCapabilities>({});
  const [zoomLevel, setZoomLevel] = useState(1);
  const [torchOn, setTorchOn] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const shouldResumeOnVisibleRef = useRef(false);
  const lastStartOverridesRef = useRef<Partial<UseCameraOptions>>({});

  const isSupported =
    typeof navigator !== 'undefined' &&
    'mediaDevices' in navigator &&
    'getUserMedia' in navigator.mediaDevices;

  const hasMultipleCameras = devices.length > 1;

  // Enumerate available video devices
  const enumerateDevicesAction = useCallback(async () => {
    if (!isSupported) return;
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 4)}`,
          groupId: d.groupId,
        }));
      setDevices(videoDevices);
    } catch {
      // Enumeration may fail before permission grant — ignore
    }
  }, [isSupported]);

  const clearStream = useCallback((preserveResume = false) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
    setTorchOn(false);
    setZoomLevel(1);
    setCapabilities({});
    if (!preserveResume) {
      shouldResumeOnVisibleRef.current = false;
    }
  }, []);

  // Stop the current stream
  const stop = useCallback(() => {
    clearStream(false);
  }, [clearStream]);

  // Read capabilities from the active video track
  // Note: zoom/torch are Chrome/Android extensions not in standard TS types
  const readCapabilities = useCallback((mediaStream: MediaStream) => {
    const track = mediaStream.getVideoTracks()[0];
    if (!track) return;

    try {
      const caps = track.getCapabilities?.() as Record<string, unknown> | undefined;
      if (!caps) return;

      const newCaps: CameraCapabilities = {};

      if (caps.zoom && typeof caps.zoom === 'object') {
        const zoomRange = caps.zoom as { min?: number; max?: number; step?: number };
        newCaps.zoom = {
          min: zoomRange.min ?? 1,
          max: zoomRange.max ?? 1,
          step: zoomRange.step ?? 0.1,
        };
      }

      if ('torch' in caps) {
        newCaps.torch = true;
      }

      setCapabilities(newCaps);
    } catch {
      // getCapabilities not supported in all browsers
    }
  }, []);

  // Start camera with given constraints
  const start = useCallback(
    async (overrides: Partial<UseCameraOptions> = {}) => {
      if (!isSupported) {
        setError('Camera API not supported');
        setErrorType('not-supported');
        return;
      }

      setIsLoading(true);
      setError(null);
      setErrorType(null);

      // Stop existing stream
      clearStream(true);
      lastStartOverridesRef.current = overrides;

      const mode = overrides.facingMode ?? facingMode;
      const res = overrides.resolution ?? initialResolution;

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: mode,
            ...(res
              ? { width: { ideal: res.width }, height: { ideal: res.height } }
              : { width: { ideal: 1920 }, height: { ideal: 1080 } }),
          },
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = mediaStream;
        setStream(mediaStream);
        setFacingModeState(mode);
        shouldResumeOnVisibleRef.current = true;

        readCapabilities(mediaStream);

        // Re-enumerate after permission grant (labels become available)
        await enumerateDevicesAction();
      } catch (err) {
        const classified = classifyError(err);
        setError(classified.message);
        setErrorType(classified.type);
        shouldResumeOnVisibleRef.current = false;
      } finally {
        setIsLoading(false);
      }
    },
    [isSupported, facingMode, initialResolution, clearStream, readCapabilities, enumerateDevicesAction],
  );

  // Switch between front and back cameras
  const switchCamera = useCallback(async () => {
    const newMode: FacingMode = facingMode === 'environment' ? 'user' : 'environment';
    await start({ facingMode: newMode });
  }, [facingMode, start]);

  // Set specific facing mode
  const setFacingMode = useCallback(
    async (mode: FacingMode) => {
      if (mode !== facingMode) {
        await start({ facingMode: mode });
      }
    },
    [facingMode, start],
  );

  // Capture a photo from the video element
  const capture = useCallback(
    (
      videoRef: React.RefObject<HTMLVideoElement | null>,
      canvasRef: React.RefObject<HTMLCanvasElement | null>,
      quality = 0.92,
    ) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return null;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Mirror front camera
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0);

      // Reset transform
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);

      // Convert to file synchronously via base64
      const byteString = atob(dataUrl.split(',')[1]);
      const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });

      return {
        file,
        dataUrl,
        width: video.videoWidth,
        height: video.videoHeight,
      };
    },
    [facingMode],
  );

  // Set zoom level
  const setZoom = useCallback(
    async (level: number) => {
      if (!streamRef.current || !capabilities.zoom) return;

      const track = streamRef.current.getVideoTracks()[0];
      if (!track) return;

      const clamped = Math.min(Math.max(level, capabilities.zoom.min), capabilities.zoom.max);
      try {
        await track.applyConstraints({
          advanced: [{ zoom: clamped } as MediaTrackConstraintSet],
        });
        setZoomLevel(clamped);
      } catch {
        // Zoom not supported
      }
    },
    [capabilities.zoom],
  );

  // Toggle torch / flashlight
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !capabilities.torch) return;

    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    const newTorchState = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: newTorchState } as MediaTrackConstraintSet],
      });
      setTorchOn(newTorchState);
    } catch {
      // Torch not supported
    }
  }, [capabilities.torch, torchOn]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (streamRef.current) {
          clearStream(true);
        }
        return;
      }

      if (!shouldResumeOnVisibleRef.current || streamRef.current || isLoading) {
        return;
      }
      void start(lastStartOverridesRef.current);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearStream, isLoading, start]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearStream(false);
    };
  }, [clearStream]);

  return {
    stream,
    isLoading,
    error,
    errorType,
    facingMode,
    devices,
    capabilities,
    isSupported,
    hasMultipleCameras,
    zoomLevel,
    torchOn,
    start,
    stop,
    switchCamera,
    setFacingMode,
    capture,
    setZoom,
    toggleTorch,
    enumerateDevices: enumerateDevicesAction,
  };
}
