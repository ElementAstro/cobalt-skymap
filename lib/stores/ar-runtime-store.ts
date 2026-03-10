import { create } from 'zustand';
import type {
  ARCameraRuntimeState,
  ARSensorRuntimeState,
} from '@/lib/core/ar-session';
import {
  DEFAULT_AR_CAMERA_RUNTIME_STATE,
  DEFAULT_AR_SENSOR_RUNTIME_STATE,
} from '@/lib/core/ar-session';

interface ARRuntimeStoreState {
  camera: ARCameraRuntimeState;
  sensor: ARSensorRuntimeState;
  setCameraRuntime: (next: Partial<ARCameraRuntimeState>) => void;
  setSensorRuntime: (next: Partial<ARSensorRuntimeState>) => void;
  resetCameraRuntime: () => void;
  resetSensorRuntime: () => void;
}

export const useARRuntimeStore = create<ARRuntimeStoreState>((set) => ({
  camera: DEFAULT_AR_CAMERA_RUNTIME_STATE,
  sensor: DEFAULT_AR_SENSOR_RUNTIME_STATE,
  setCameraRuntime: (next) =>
    set((state) => ({
      camera: {
        ...state.camera,
        ...next,
      },
    })),
  setSensorRuntime: (next) =>
    set((state) => ({
      sensor: {
        ...state.sensor,
        ...next,
      },
    })),
  resetCameraRuntime: () => set({ camera: DEFAULT_AR_CAMERA_RUNTIME_STATE }),
  resetSensorRuntime: () => set({ sensor: DEFAULT_AR_SENSOR_RUNTIME_STATE }),
}));
