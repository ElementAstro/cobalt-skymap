/**
 * Plate Solver Store
 * Zustand store for managing plate solver state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createLogger } from '@/lib/logger';
import {
  createInitialOnlineSolveSessionState,
  type OnlineSolveSessionState,
} from '@/lib/plate-solving/online-solve-contract';
import type {
  SolverType,
  SolverInfo,
  SolverConfig,
  SolveResult,
  IndexInfo,
  DownloadableIndex,
  AstapDatabaseInfo,
  ImageAnalysisResult,
  OnlineSolveProgress,
} from '@/lib/tauri/plate-solver-api';
import type { SolveHistoryEntry } from '@/types/starmap/plate-solving';
import {
  detectPlateSolvers,
  loadSolverConfig,
  saveSolverConfig,
  getAvailableIndexes,
  getInstalledIndexes,
  getAstapDatabases,
  analyseImage as analyseImageApi,
  DEFAULT_SOLVER_CONFIG,
} from '@/lib/tauri/plate-solver-api';

const MAX_HISTORY_ENTRIES = 50;
const logger = createLogger('plate-solver-store');

// ============================================================================
// Types
// ============================================================================

export type SolveStatus = 'idle' | 'preparing' | 'solving' | 'success' | 'failed';

export interface PlateSolverState {
  // Detected solvers
  detectedSolvers: SolverInfo[];
  isDetecting: boolean;
  detectionError: string | null;
  
  // Current configuration
  config: SolverConfig;
  
  // Online API key (for astrometry.net online)
  onlineApiKey: string;
  
  // Solve state
  solveStatus: SolveStatus;
  solveProgress: number;
  solveMessage: string;
  lastResult: SolveResult | null;
  
  // Index management
  availableIndexes: DownloadableIndex[];
  installedIndexes: IndexInfo[];
  isLoadingIndexes: boolean;
  
  // Download state
  downloadingIndexes: Map<string, { progress: number; status: string }>;
  
  // ASTAP databases
  astapDatabases: AstapDatabaseInfo[];
  isLoadingAstapDatabases: boolean;
  
  // Image analysis
  imageAnalysis: ImageAnalysisResult | null;
  isAnalysingImage: boolean;
  
  // Online solve progress
  onlineSolveProgress: OnlineSolveProgress | null;
  onlineSession: OnlineSolveSessionState;
  
  // Solve history
  solveHistory: SolveHistoryEntry[];
  
  // Actions
  detectSolvers: () => Promise<void>;
  setConfig: (config: Partial<SolverConfig>) => void;
  saveConfig: () => Promise<void>;
  loadConfig: () => Promise<void>;
  setOnlineApiKey: (key: string) => void;
  setSolveStatus: (status: SolveStatus, message?: string, progress?: number) => void;
  setLastResult: (result: SolveResult | null) => void;
  loadAvailableIndexes: (solverType: SolverType) => Promise<void>;
  loadInstalledIndexes: (solverType: SolverType, indexPath?: string) => Promise<void>;
  setDownloadProgress: (fileName: string, progress: number, status: string) => void;
  clearDownloadProgress: (fileName: string) => void;
  loadAstapDatabases: () => Promise<void>;
  analyseImage: (imagePath: string, snrMinimum?: number) => Promise<void>;
  setOnlineSolveProgress: (progress: OnlineSolveProgress | null) => void;
  setOnlineSession: (session: OnlineSolveSessionState | null) => void;
  clearImageAnalysis: () => void;
  addToHistory: (entry: Omit<SolveHistoryEntry, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  detectedSolvers: [] as SolverInfo[],
  isDetecting: false,
  detectionError: null as string | null,
  config: DEFAULT_SOLVER_CONFIG,
  onlineApiKey: '',
  solveStatus: 'idle' as SolveStatus,
  solveProgress: 0,
  solveMessage: '',
  lastResult: null as SolveResult | null,
  availableIndexes: [] as DownloadableIndex[],
  installedIndexes: [] as IndexInfo[],
  isLoadingIndexes: false,
  downloadingIndexes: new Map<string, { progress: number; status: string }>(),
  astapDatabases: [] as AstapDatabaseInfo[],
  isLoadingAstapDatabases: false,
  imageAnalysis: null as ImageAnalysisResult | null,
  isAnalysingImage: false,
  onlineSolveProgress: null as OnlineSolveProgress | null,
  onlineSession: createInitialOnlineSolveSessionState(),
  solveHistory: [] as SolveHistoryEntry[],
};

// ============================================================================
// Store
// ============================================================================

export const usePlateSolverStore = create<PlateSolverState>()(
  persist(
    (set, get) => ({
      ...initialState,

      detectSolvers: async () => {
        set({ isDetecting: true, detectionError: null });
        try {
          const solvers = await detectPlateSolvers();
          set({ detectedSolvers: solvers, isDetecting: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Detection failed';
          set({ detectionError: message, isDetecting: false });
        }
      },

      setConfig: (partialConfig) => {
        set((state) => ({
          config: { ...state.config, ...partialConfig },
        }));
      },

      saveConfig: async () => {
        const { config } = get();
        try {
          await saveSolverConfig(config);
        } catch (error) {
          logger.error('Failed to save solver config', error);
        }
      },

      loadConfig: async () => {
        try {
          const config = await loadSolverConfig();
          set({ config });
        } catch (error) {
          logger.error('Failed to load solver config', error);
          // Use default config
          set({ config: DEFAULT_SOLVER_CONFIG });
        }
      },

      setOnlineApiKey: (key) => {
        set({ onlineApiKey: key });
      },

      setSolveStatus: (status, message = '', progress = 0) => {
        set({ solveStatus: status, solveMessage: message, solveProgress: progress });
      },

      setLastResult: (result) => {
        set({ lastResult: result });
      },

      loadAvailableIndexes: async (solverType) => {
        set({ isLoadingIndexes: true });
        try {
          const indexes = await getAvailableIndexes(solverType);
          set({ availableIndexes: indexes, isLoadingIndexes: false });
        } catch (error) {
          logger.error('Failed to load available indexes', error);
          set({ isLoadingIndexes: false });
        }
      },

      loadInstalledIndexes: async (solverType, indexPath) => {
        set({ isLoadingIndexes: true });
        try {
          const indexes = await getInstalledIndexes(solverType, indexPath);
          set({ installedIndexes: indexes, isLoadingIndexes: false });
        } catch (error) {
          logger.error('Failed to load installed indexes', error);
          set({ isLoadingIndexes: false });
        }
      },

      setDownloadProgress: (fileName, progress, status) => {
        set((state) => {
          const newMap = new Map(state.downloadingIndexes);
          newMap.set(fileName, { progress, status });
          return { downloadingIndexes: newMap };
        });
      },

      clearDownloadProgress: (fileName) => {
        set((state) => {
          const newMap = new Map(state.downloadingIndexes);
          newMap.delete(fileName);
          return { downloadingIndexes: newMap };
        });
      },

      loadAstapDatabases: async () => {
        set({ isLoadingAstapDatabases: true });
        try {
          const databases = await getAstapDatabases();
          set({ astapDatabases: databases, isLoadingAstapDatabases: false });
        } catch (error) {
          logger.error('Failed to load ASTAP databases', error);
          set({ isLoadingAstapDatabases: false });
        }
      },

      analyseImage: async (imagePath, snrMinimum) => {
        set({ isAnalysingImage: true, imageAnalysis: null });
        try {
          const result = await analyseImageApi(imagePath, snrMinimum);
          set({ imageAnalysis: result, isAnalysingImage: false });
        } catch (error) {
          logger.error('Failed to analyse image', error);
          set({
            isAnalysingImage: false,
            imageAnalysis: {
              success: false,
              median_hfd: null,
              star_count: 0,
              background: null,
              noise: null,
              stars: [],
              error_message: error instanceof Error ? error.message : 'Analysis failed',
            },
          });
        }
      },

      setOnlineSolveProgress: (progress) => {
        set({ onlineSolveProgress: progress });
      },

      setOnlineSession: (session) => {
        set({ onlineSession: session ?? createInitialOnlineSolveSessionState() });
      },

      clearImageAnalysis: () => {
        set({ imageAnalysis: null });
      },

      addToHistory: (entry) => {
        set((state) => {
          const newEntry: SolveHistoryEntry = {
            ...entry,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
          };
          const history = [newEntry, ...state.solveHistory].slice(0, MAX_HISTORY_ENTRIES);
          return { solveHistory: history };
        });
      },

      clearHistory: () => {
        set({ solveHistory: [] });
      },

      reset: () => {
        set({
          solveStatus: 'idle',
          solveProgress: 0,
          solveMessage: '',
          lastResult: null,
          imageAnalysis: null,
          onlineSolveProgress: null,
          onlineSession: createInitialOnlineSolveSessionState(),
        });
      },
    }),
    {
      name: 'plate-solver-storage',
      partialize: (state) => ({
        config: state.config,
        onlineApiKey: state.onlineApiKey,
        solveHistory: state.solveHistory,
      }),
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectActiveSolver = (state: PlateSolverState): SolverInfo | undefined => {
  const solvers = state.detectedSolvers ?? [];
  const config = state.config ?? DEFAULT_SOLVER_CONFIG;
  return solvers.find(
    (solver) => solver.solver_type === config.solver_type
  );
};

export const selectIsLocalSolverAvailable = (state: PlateSolverState): boolean => {
  const activeSolver = selectActiveSolver(state);
  if (!activeSolver) return false;
  if (activeSolver.solver_type === 'astrometry_net_online') return true;
  return activeSolver.installed_indexes.length > 0;
};

export const selectCanSolve = (state: PlateSolverState): boolean => {
  const config = state.config ?? DEFAULT_SOLVER_CONFIG;
  if (config.solver_type === 'astrometry_net_online') {
    return !!state.onlineApiKey;
  }
  return selectIsLocalSolverAvailable(state);
};

export const selectOnlineSession = (state: PlateSolverState): OnlineSolveSessionState =>
  state.onlineSession;
