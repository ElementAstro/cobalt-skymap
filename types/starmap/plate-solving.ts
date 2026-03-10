/**
 * Type definitions for plate-solving components
 * Extracted from components/starmap/plate-solving/ for architectural separation
 */

import type {
  FITSMetadata,
  OnlineSolveDiagnostics,
  PlateSolveResult,
  SolveProgress,
} from '@/lib/plate-solving';
import type { SolverType } from '@/lib/tauri/plate-solver-api';

// ============================================================================
// ImageCapture
// ============================================================================

export interface ImageMetadata {
  width: number;
  height: number;
  size: number;
  type: string;
  name: string;
  isFits?: boolean;
  fitsData?: FITSMetadata;
}

export interface ImageCaptureProps {
  onImageCapture: (file: File, metadata?: ImageMetadata) => void;
  trigger?: React.ReactNode;
  className?: string;
  maxFileSizeMB?: number;
  enableCompression?: boolean;
  acceptedFormats?: string[];
}

// ============================================================================
// IndexManager
// ============================================================================

export interface IndexManagerProps {
  solverType?: SolverType;
  trigger?: React.ReactNode;
  className?: string;
}

export interface DownloadState {
  fileName: string;
  progress: number;
  status: 'downloading' | 'extracting' | 'complete' | 'error';
  error?: string;
}

// ============================================================================
// PlateSolverUnified
// ============================================================================

export interface PlateSolverUnifiedProps {
  onSolveComplete?: (result: PlateSolveResult) => void;
  onGoToCoordinates?: (ra: number, dec: number) => void;
  trigger?: React.ReactNode;
  className?: string;
  defaultImagePath?: string;
  raHint?: number;
  decHint?: number;
  fovHint?: number;
}

export type SolveMode = 'online' | 'local';

// ============================================================================
// Solve History
// ============================================================================

export interface SolveHistoryEntry {
  id: string;
  timestamp: number;
  imageName: string;
  solveMode: SolveMode;
  result: PlateSolveResult;
  diagnostics?: OnlineSolveDiagnostics;
}

// ============================================================================
// SolveResultCard
// ============================================================================

export interface SolveResultCardProps {
  result: PlateSolveResult;
  onGoTo?: () => void;
}

// ============================================================================
// SolverSettings
// ============================================================================

export interface SolverSettingsProps {
  onClose?: () => void;
  className?: string;
}

// ============================================================================
// Solve Progress Utilities (used by PlateSolverUnified)
// ============================================================================

export interface ProgressTextOptions {
  progress: SolveProgress | null;
  t: (key: string) => string;
}

export interface ProgressPercentOptions {
  solveMode: SolveMode;
  localProgress: number;
  progress: SolveProgress | null;
}

// ============================================================================
// Image Analysis Card
// ============================================================================

export interface ImageAnalysisCardProps {
  imagePath?: string;
  className?: string;
  onAnalyse?: (imagePath: string) => void;
}

// ============================================================================
// ASTAP Database Manager
// ============================================================================

export interface AstapDatabaseManagerProps {
  className?: string;
  onDatabaseChange?: () => void;
}
