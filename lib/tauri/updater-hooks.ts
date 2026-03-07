import { useEffect, useCallback, useRef } from 'react';
import { createLogger } from '@/lib/logger';
import {
  UpdateInfo,
  UpdateProgress,
  checkForUpdate as apiCheckForUpdate,
  downloadUpdate as apiDownloadUpdate,
  installUpdate as apiInstallUpdate,
  downloadAndInstallUpdate as apiDownloadAndInstallUpdate,
  getCurrentVersion,
  clearPendingUpdate,
  onUpdateProgress,
  isUpdateAvailable,
  isUpdateReady,
  isUpdateDownloading,
  isUpdateError,
} from './updater-api';
import {
  useUpdaterStore,
  selectIsChecking,
  selectIsDownloading,
  selectIsReady,
  selectHasUpdate,
  selectUpdateInfo,
  selectProgress,
  selectError,
} from '@/lib/stores/updater-store';

const logger = createLogger('updater-hooks');

export interface UseUpdaterOptions {
  autoCheck?: boolean;
  checkInterval?: number;
  onUpdateAvailable?: (info: UpdateInfo) => void;
  onUpdateReady?: (info: UpdateInfo) => void;
  onError?: (error: string) => void;
}

export interface UseUpdaterReturn {
  status: ReturnType<typeof useUpdaterStore.getState>['status'];
  currentVersion: string | null;
  lastChecked: number | null;
  skippedVersion: string | null;
  downloadSpeed: number | null;
  estimatedTimeRemaining: number | null;
  isChecking: boolean;
  isDownloading: boolean;
  isReady: boolean;
  hasUpdate: boolean;
  updateInfo: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | null;
  checkForUpdate: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  dismissUpdate: () => void;
  skipVersion: (version: string) => void;
}

export function useUpdater(options: UseUpdaterOptions = {}): UseUpdaterReturn {
  const {
    autoCheck = false,
    checkInterval = 3600000,
    onUpdateAvailable,
    onUpdateReady,
    onError,
  } = options;

  const status = useUpdaterStore((s) => s.status);
  const currentVersion = useUpdaterStore((s) => s.currentVersion);
  const lastChecked = useUpdaterStore((s) => s.lastChecked);
  const skippedVersion = useUpdaterStore((s) => s.skippedVersion);
  const downloadSpeed = useUpdaterStore((s) => s.downloadSpeed);
  const estimatedTimeRemaining = useUpdaterStore((s) => s.estimatedTimeRemaining);
  const setStatus = useUpdaterStore((s) => s.setStatus);
  const setCurrentVersion = useUpdaterStore((s) => s.setCurrentVersion);
  const setLastChecked = useUpdaterStore((s) => s.setLastChecked);
  const setSkippedVersion = useUpdaterStore((s) => s.setSkippedVersion);
  const setDownloadMetrics = useUpdaterStore((s) => s.setDownloadMetrics);

  const unlistenRef = useRef<(() => void) | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const downloadStartRef = useRef<{ time: number; bytes: number } | null>(null);

  const isChecking = selectIsChecking(useUpdaterStore.getState());
  const isDownloading = selectIsDownloading(useUpdaterStore.getState());
  const isReady = selectIsReady(useUpdaterStore.getState());
  const hasUpdate = selectHasUpdate(useUpdaterStore.getState());
  const updateInfo = selectUpdateInfo(useUpdaterStore.getState());
  const progress = selectProgress(useUpdaterStore.getState());
  const error = selectError(useUpdaterStore.getState());

  useEffect(() => {
    if (!currentVersion) {
      getCurrentVersion()
        .then(setCurrentVersion)
        .catch(err => logger.error('Failed to get current version', err));
    }

    const setupListener = async () => {
      unlistenRef.current = await onUpdateProgress((newStatus) => {
        setStatus(newStatus);
        if (isUpdateDownloading(newStatus)) {
          const now = Date.now();
          const progressData = newStatus.data;
          if (!downloadStartRef.current) {
            downloadStartRef.current = { time: now, bytes: progressData.downloaded };
          } else {
            const elapsed = (now - downloadStartRef.current.time) / 1000;
            if (elapsed > 0.5) {
              const bytesTransferred = progressData.downloaded - downloadStartRef.current.bytes;
              const speed = bytesTransferred / elapsed;
              const remaining = progressData.total
                ? (progressData.total - progressData.downloaded) / Math.max(speed, 1)
                : null;
              setDownloadMetrics(speed, remaining);
            }
          }
        }
      });
    };

    setupListener();

    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isUpdateAvailable(status) && onUpdateAvailable) {
      onUpdateAvailable(status.data);
    }
    if (isUpdateReady(status) && onUpdateReady) {
      onUpdateReady(status.data);
    }
    if (isUpdateError(status) && onError) {
      onError(status.data);
    }
  }, [status, onUpdateAvailable, onUpdateReady, onError]);

  const handleCheckForUpdate = useCallback(async () => {
    setStatus({ status: 'checking' });
    const result = await apiCheckForUpdate();
    setLastChecked(Date.now());

    if (isUpdateAvailable(result)) {
      const store = useUpdaterStore.getState();
      if (store.skippedVersion && result.data.version === store.skippedVersion) {
        setStatus({ status: 'not_available' });
        return;
      }
    }

    setStatus(result);
  }, [setStatus, setLastChecked]);

  useEffect(() => {
    if (!autoCheck) return;

    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const doCheck = async () => {
      if (!mounted) return;
      setStatus({ status: 'checking' });
      const result = await apiCheckForUpdate();
      if (mounted) {
        setLastChecked(Date.now());

        if (isUpdateAvailable(result)) {
          const store = useUpdaterStore.getState();
          if (store.skippedVersion && result.data.version === store.skippedVersion) {
            setStatus({ status: 'not_available' });
            return;
          }
        }

        setStatus(result);
      }
    };

    timeoutId = setTimeout(doCheck, 0);

    checkIntervalRef.current = setInterval(() => {
      if (mounted) doCheck();
    }, checkInterval);

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [autoCheck, checkInterval, setStatus, setLastChecked]);

  const handleDownloadUpdate = useCallback(async () => {
    const store = useUpdaterStore.getState();
    if (!selectHasUpdate(store)) return;
    downloadStartRef.current = null;
    setDownloadMetrics(null, null);
    setStatus({ status: 'downloading', data: { downloaded: 0, total: null, percent: 0 } });
    const result = await apiDownloadUpdate();
    downloadStartRef.current = null;
    setStatus(result);
  }, [setStatus, setDownloadMetrics]);

  const handleInstallUpdate = useCallback(async () => {
    const store = useUpdaterStore.getState();
    if (!selectIsReady(store)) return;
    try {
      const result = await apiInstallUpdate();
      if (isUpdateError(result)) {
        setStatus(result);
      }
    } catch (err) {
      setStatus({
        status: 'error',
        data: err instanceof Error ? err.message : String(err),
      });
    }
  }, [setStatus]);

  const handleDownloadAndInstall = useCallback(async () => {
    const store = useUpdaterStore.getState();
    if (!selectHasUpdate(store)) return;
    downloadStartRef.current = null;
    setDownloadMetrics(null, null);
    setStatus({ status: 'downloading', data: { downloaded: 0, total: null, percent: 0 } });
    try {
      const result = await apiDownloadAndInstallUpdate();
      if (isUpdateError(result)) {
        setStatus(result);
      }
    } catch (err) {
      setStatus({
        status: 'error',
        data: err instanceof Error ? err.message : String(err),
      });
    }
  }, [setStatus, setDownloadMetrics]);

  const dismissUpdate = useCallback(() => {
    clearPendingUpdate();
    setStatus({ status: 'idle' });
    downloadStartRef.current = null;
    setDownloadMetrics(null, null);
  }, [setStatus, setDownloadMetrics]);

  const skipVersion = useCallback((version: string) => {
    setSkippedVersion(version);
    clearPendingUpdate();
    setStatus({ status: 'idle' });
  }, [setSkippedVersion, setStatus]);

  return {
    status,
    currentVersion,
    lastChecked,
    skippedVersion,
    downloadSpeed,
    estimatedTimeRemaining,
    isChecking,
    isDownloading,
    isReady,
    hasUpdate,
    updateInfo,
    progress,
    error,
    checkForUpdate: handleCheckForUpdate,
    downloadUpdate: handleDownloadUpdate,
    installUpdate: handleInstallUpdate,
    downloadAndInstall: handleDownloadAndInstall,
    dismissUpdate,
    skipVersion,
  };
}

export function useAutoUpdater(options: Omit<UseUpdaterOptions, 'autoCheck'> = {}) {
  return useUpdater({ ...options, autoCheck: true });
}
