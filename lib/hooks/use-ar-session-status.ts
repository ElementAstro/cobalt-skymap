import { useMemo } from 'react';
import {
  deriveARSessionState,
  type ARSessionDerivedState,
  type ARSessionInput,
} from '@/lib/core/ar-session';
import { useSettingsStore } from '@/lib/stores';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';

interface UseARSessionStatusOptions {
  enabled?: boolean;
}

export function useARSessionStatus(
  options: UseARSessionStatusOptions = {}
): ARSessionDerivedState {
  const arMode = useSettingsStore((state) => state.stellarium.arMode);
  const arShowCompass = useSettingsStore((state) => state.stellarium.arShowCompass);
  const cameraRuntime = useARRuntimeStore((state) => state.camera);
  const sensorRuntime = useARRuntimeStore((state) => state.sensor);

  const enabled = options.enabled ?? arMode;
  const input = useMemo<ARSessionInput>(
    () => ({
      enabled,
      showCompassPreference: arShowCompass,
      camera: cameraRuntime,
      sensor: sensorRuntime,
    }),
    [enabled, arShowCompass, cameraRuntime, sensorRuntime]
  );

  return useMemo(() => deriveARSessionState(input), [input]);
}
