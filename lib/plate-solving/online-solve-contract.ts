import type { SolveProgress } from './astrometry-api';
import type { OnlineSolveProgress } from '@/lib/tauri/plate-solver-api';

export type OnlineSolveRuntime = 'tauri' | 'web';

export type OnlineSolveLifecycleStage =
  | 'idle'
  | 'preflight'
  | 'authenticating'
  | 'uploading'
  | 'queued'
  | 'solving'
  | 'fetching'
  | 'success'
  | 'failed'
  | 'cancelled';

export type OnlineSolveErrorCode =
  | 'missing_api_key'
  | 'offline'
  | 'auth_failed'
  | 'upload_failed'
  | 'timeout'
  | 'network'
  | 'service_failed'
  | 'cancelled'
  | 'invalid_image'
  | 'unknown';

export interface OnlineSolveDiagnostics {
  runtime: OnlineSolveRuntime;
  attemptCount: number;
  maxAttempts: number;
  terminalErrorCode?: OnlineSolveErrorCode | null;
  cancelled?: boolean;
  submissionId?: number | null;
  jobId?: number | null;
  operationId?: string | null;
}

export interface OnlineSolveSessionState {
  stage: OnlineSolveLifecycleStage;
  runtime: OnlineSolveRuntime;
  progress: number;
  attempt: number;
  maxAttempts: number;
  message: string;
  errorCode: OnlineSolveErrorCode | null;
  errorMessage: string | null;
  cancelled: boolean;
  subId: number | null;
  jobId: number | null;
  operationId: string | null;
}

export function createInitialOnlineSolveSessionState(
  runtime: OnlineSolveRuntime = 'web'
): OnlineSolveSessionState {
  return {
    stage: 'idle',
    runtime,
    progress: 0,
    attempt: 0,
    maxAttempts: 0,
    message: '',
    errorCode: null,
    errorMessage: null,
    cancelled: false,
    subId: null,
    jobId: null,
    operationId: null,
  };
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function mapTauriProgressToOnlineSession(
  payload: OnlineSolveProgress,
  current: OnlineSolveSessionState
): OnlineSolveSessionState {
  const stage = payload.stage.toLowerCase();
  const nextBase: OnlineSolveSessionState = {
    ...current,
    runtime: 'tauri',
    message: payload.message ?? current.message,
    progress: clampProgress(payload.progress),
    subId: payload.sub_id ?? current.subId,
    jobId: payload.job_id ?? current.jobId,
    operationId: payload.operation_id ?? current.operationId,
  };

  if (stage === 'login') return { ...nextBase, stage: 'authenticating' };
  if (stage === 'upload') return { ...nextBase, stage: 'uploading' };
  if (stage === 'processing') {
    return payload.sub_id !== null
      ? { ...nextBase, stage: 'queued' }
      : { ...nextBase, stage: 'uploading' };
  }
  if (stage === 'solving') return { ...nextBase, stage: 'solving' };
  if (stage === 'fetching') return { ...nextBase, stage: 'fetching' };
  if (stage === 'complete') return { ...nextBase, stage: 'success', progress: 100 };

  return nextBase;
}

export function mapWebProgressToOnlineSession(
  payload: SolveProgress,
  current: OnlineSolveSessionState
): OnlineSolveSessionState {
  if (payload.stage === 'uploading') {
    return {
      ...current,
      runtime: 'web',
      stage: 'uploading',
      progress: clampProgress(payload.progress),
      message: '',
      errorCode: null,
      errorMessage: null,
      cancelled: false,
    };
  }

  if (payload.stage === 'queued') {
    return {
      ...current,
      runtime: 'web',
      stage: 'queued',
      progress: 30,
      subId: payload.subid,
      message: '',
    };
  }

  if (payload.stage === 'processing') {
    return {
      ...current,
      runtime: 'web',
      stage: 'solving',
      progress: 60,
      jobId: payload.jobId,
      message: '',
    };
  }

  if (payload.stage === 'success') {
    return {
      ...current,
      runtime: 'web',
      stage: 'success',
      progress: 100,
      message: '',
      errorCode: null,
      errorMessage: null,
      cancelled: false,
    };
  }

  const { code, message } = classifyOnlineSolveError(payload.error);
  return {
    ...current,
    runtime: 'web',
    stage: code === 'cancelled' ? 'cancelled' : 'failed',
    progress: 100,
    message,
    errorCode: code,
    errorMessage: message,
    cancelled: code === 'cancelled',
  };
}

export function classifyOnlineSolveError(input: unknown): {
  code: OnlineSolveErrorCode;
  message: string;
} {
  const message = input instanceof Error
    ? input.message
    : typeof input === 'string'
      ? input
      : 'Unknown online solve error';

  const text = message.toLowerCase();

  if (text.includes('missing_api_key') || text.includes('api key required')) {
    return { code: 'missing_api_key', message };
  }
  if (text.includes('offline') || text.includes('network is offline')) {
    return { code: 'offline', message };
  }
  if (text.includes('cancelled') || text.includes('canceled')) {
    return { code: 'cancelled', message };
  }
  if (text.includes('auth_failed') || text.includes('login failed') || text.includes('invalid api key')) {
    return { code: 'auth_failed', message };
  }
  if (text.includes('upload_failed') || text.includes('upload failed')) {
    return { code: 'upload_failed', message };
  }
  if (text.includes('timeout') || text.includes('timed out')) {
    return { code: 'timeout', message };
  }
  if (text.includes('invalid image') || text.includes('image not found')) {
    return { code: 'invalid_image', message };
  }
  if (text.includes('network') || text.includes('dns') || text.includes('connection')) {
    return { code: 'network', message };
  }
  if (text.includes('service_failed') || text.includes('service')) {
    return { code: 'service_failed', message };
  }

  return { code: 'unknown', message };
}

export function isRetryableOnlineError(code: OnlineSolveErrorCode): boolean {
  return code === 'timeout' || code === 'network' || code === 'service_failed';
}
