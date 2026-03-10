import {
  classifyOnlineSolveError,
  createInitialOnlineSolveSessionState,
  isRetryableOnlineError,
  mapTauriProgressToOnlineSession,
  mapWebProgressToOnlineSession,
} from '../online-solve-contract';

describe('online-solve-contract', () => {
  it('maps tauri login progress to authenticating stage', () => {
    const current = createInitialOnlineSolveSessionState('tauri');
    const mapped = mapTauriProgressToOnlineSession(
      {
        stage: 'login',
        progress: 0,
        message: 'Authenticating...',
        sub_id: null,
        job_id: null,
        operation_id: 'op-1',
      },
      current
    );

    expect(mapped.stage).toBe('authenticating');
    expect(mapped.operationId).toBe('op-1');
  });

  it('maps tauri processing with sub_id to queued stage', () => {
    const current = createInitialOnlineSolveSessionState('tauri');
    const mapped = mapTauriProgressToOnlineSession(
      {
        stage: 'processing',
        progress: 34,
        message: 'Waiting for job...',
        sub_id: 101,
        job_id: null,
        operation_id: 'op-2',
      },
      current
    );

    expect(mapped.stage).toBe('queued');
    expect(mapped.subId).toBe(101);
  });

  it('maps web failed progress to classified terminal failure', () => {
    const current = createInitialOnlineSolveSessionState('web');
    const mapped = mapWebProgressToOnlineSession(
      { stage: 'failed', error: 'Login failed: invalid api key' },
      current
    );

    expect(mapped.stage).toBe('failed');
    expect(mapped.errorCode).toBe('auth_failed');
  });

  it('classifies cancellation errors', () => {
    const classified = classifyOnlineSolveError(new Error('Solve cancelled by user'));
    expect(classified.code).toBe('cancelled');
  });

  it('marks timeout/network/service failures as retryable', () => {
    expect(isRetryableOnlineError('timeout')).toBe(true);
    expect(isRetryableOnlineError('network')).toBe(true);
    expect(isRetryableOnlineError('service_failed')).toBe(true);
    expect(isRetryableOnlineError('auth_failed')).toBe(false);
  });
});
