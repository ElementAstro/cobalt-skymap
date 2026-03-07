'use client';

import { useCallback, useEffect, useRef, useState, RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { useStellariumStore, useSettingsStore, useMountStore } from '@/lib/stores';
import { degreesToHMS, degreesToDMS, rad2deg } from '@/lib/astronomy/starmap-utils';
import { createStellariumTranslator } from '@/lib/translations';
import { createLogger } from '@/lib/logger';
import { DEFAULT_FOV } from '@/lib/core/constants/fov';
import { getEffectiveDpr } from '@/lib/core/stellarium-canvas-utils';
import {
  SCRIPT_LOAD_TIMEOUT,
  WASM_INIT_TIMEOUT,
  MAX_RETRY_COUNT,
  SCRIPT_PATH,
  WASM_PATH,
  ENGINE_FOV_INIT_DELAY,
  ENGINE_SETTINGS_INIT_DELAY,
  RETRY_DELAY_MS,
  OVERALL_LOADING_TIMEOUT,
} from '@/lib/core/constants/stellarium-canvas';
import { withTimeout, fovToRad } from '@/lib/core/stellarium-canvas-utils';
import { pointAndLockTargetAt } from './target-object-pool';
import type { StellariumEngine, SelectedObjectData } from '@/lib/core/types';
import type { LoadingState } from '@/types/stellarium-canvas';

const logger = createLogger('stellarium-loader');
const TWO_PI = 2 * Math.PI;

function normalizeRadians(angle: number): number {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

function angularErrorArcsec(targetRad: number, actualRad: number): number {
  const delta = Math.abs(targetRad - actualRad);
  const wrapped = Math.min(delta, TWO_PI - delta);
  return wrapped * (180 / Math.PI) * 3600;
}

interface UseStellariumLoaderOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  stelRef: RefObject<StellariumEngine | null>;
  onSelectionChange?: (selection: SelectedObjectData | null) => void;
  onFovChange?: (fov: number) => void;
}

interface UseStellariumLoaderResult {
  loadingState: LoadingState;
  engineReady: boolean;
  startLoading: () => Promise<void>;
  handleRetry: () => void;
  reloadEngine: () => void;
}

type LoaderStage = 'script' | 'engine';

interface LoaderStageError extends Error {
  stage: LoaderStage;
}

/**
 * Hook for loading and initializing the Stellarium engine
 */
export function useStellariumLoader({
  containerRef,
  canvasRef,
  stelRef,
  onSelectionChange,
  onFovChange,
}: UseStellariumLoaderOptions): UseStellariumLoaderResult {
  const t = useTranslations('canvas');
  
  const initializingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const overallDeadlineRef = useRef<number>(0);
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  // Provide an immediate, non-empty status so the loading overlay doesn't render blank
  // for a frame before startLoading kicks in (scheduled via requestAnimationFrame).
  const [loadingStatus, setLoadingStatus] = useState(() => t('preparingResources'));
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<LoadingState['phase']>('preparing');
  const [loadingErrorCode, setLoadingErrorCode] = useState<LoadingState['errorCode']>(null);
  const [engineReady, setEngineReady] = useState(false);
  
  const setStel = useStellariumStore((state) => state.setStel);
  const setBaseUrl = useStellariumStore((state) => state.setBaseUrl);
  const setHelpers = useStellariumStore((state) => state.setHelpers);
  const updateStellariumCore = useStellariumStore((state) => state.updateStellariumCore);
  const getRenderQuality = useCallback(() => {
    // Defensive fallback for partially-migrated persisted settings.
    return useSettingsStore.getState().performance?.renderQuality ?? 'high';
  }, []);

  // Callback refs to keep initStellarium stable (avoids re-init on callback changes)
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onFovChangeRef = useRef(onFovChange);
  useEffect(() => { onSelectionChangeRef.current = onSelectionChange; }, [onSelectionChange]);
  useEffect(() => { onFovChangeRef.current = onFovChange; }, [onFovChange]);
  useEffect(() => () => {
    mountedRef.current = false;
    abortControllerRef.current?.abort();
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    initializingRef.current = false;
  }, []);
  
  // Initialize Stellarium engine with all data sources
  const initStellarium = useCallback((stel: StellariumEngine) => {
    logger.info('Stellarium is ready!');
    (stelRef as React.MutableRefObject<StellariumEngine | null>).current = stel;
    setStel(stel);

    // Set observer location from profile (read latest from store, subsequent syncs handled by useObserverSync)
    const currentProfile = useMountStore.getState().profileInfo;
    const lat = currentProfile.AstrometrySettings.Latitude || 0;
    const lon = currentProfile.AstrometrySettings.Longitude || 0;
    const elev = currentProfile.AstrometrySettings.Elevation || 0;
    
    // Use direct property assignment for Stellarium engine compatibility
    stel.core.observer.latitude = lat * stel.D2R;
    stel.core.observer.longitude = lon * stel.D2R;
    stel.core.observer.elevation = elev;

    // Set time speed to 1 and initial FOV
    // Use setTimeout to ensure the engine is fully initialized before setting FOV
    stel.core.time_speed = 1;
    setTimeout(() => {
      if (stelRef.current) {
        stelRef.current.core.fov = fovToRad(DEFAULT_FOV);
        onFovChangeRef.current?.(DEFAULT_FOV);
      }
    }, ENGINE_FOV_INIT_DELAY);

    // Helper function to get current view direction
    const getCurrentViewDirection = () => {
      const obs = stel.core.observer;
      const viewVec = [0, 0, -1];
      const icrfVec = stel.convertFrame(stel.observer, 'VIEW', 'ICRF', viewVec);
      const raDecSpherical = stel.c2s(icrfVec);
      const alt = obs.azalt[0];
      const az = obs.azalt[1];

      return {
        ra: normalizeRadians(raDecSpherical[0]),
        dec: stel.anpm(raDecSpherical[1]),
        alt,
        az,
        frame: 'ICRF' as const,
        timeScale: 'UTC' as const,
        qualityFlag: 'precise' as const,
        dataFreshness: 'fallback' as const,
      };
    };

    // Helper function to set view direction
    const setViewDirection = (raDeg: number, decDeg: number) => {
      try {
        const raRad = raDeg * stel.D2R;
        const decRad = decDeg * stel.D2R;
        const icrfVec = stel.s2c(raRad, decRad);
        const cirsVec = stel.convertFrame(stel.observer, 'ICRF', 'CIRS', icrfVec);
        pointAndLockTargetAt(stel, cirsVec);

        const actual = getCurrentViewDirection();
        const raErrArcsec = angularErrorArcsec(normalizeRadians(raRad), normalizeRadians(actual.ra));
        const decErrArcsec = Math.abs(decRad - actual.dec) * (180 / Math.PI) * 3600;
        logger.debug('setViewDirection roundtrip', {
          target: { raDeg, decDeg },
          actual: { raDeg: rad2deg(actual.ra), decDeg: rad2deg(actual.dec) },
          errorArcsec: {
            ra: Number(raErrArcsec.toFixed(3)),
            dec: Number(decErrArcsec.toFixed(3)),
          },
        });
      } catch (error) {
        logger.error('Error setting view direction', error);
      }
    };

    setHelpers({ getCurrentViewDirection, setViewDirection });

    // Data source URLs - use local data from /stellarium-data/
    const baseUrl = '/stellarium-data/';
    setBaseUrl(baseUrl);

    const core = stel.core;

    // Safe wrapper: isolate each data source load so one failure doesn't block others
    const safeAdd = (
      module: { addDataSource?: (opts: { url: string; key?: string }) => void },
      options: { url: string; key?: string },
      label: string
    ) => {
      try {
        module.addDataSource?.(options);
      } catch (error) {
        logger.warn(`Failed to load data source: ${label}`, error);
      }
    };

    // Essential data sources (loaded synchronously — needed for first render)
    safeAdd(core.stars, { url: baseUrl + 'stars' }, 'stars');
    safeAdd(core.skycultures, { url: baseUrl + 'skycultures/western', key: 'western' }, 'skycultures');
    safeAdd(core.planets, { url: baseUrl + 'surveys/sso', key: 'default' }, 'planets-default');

    // Secondary data sources (deferred via microtask to unblock initStellarium return)
    const loadSecondarySources = () => {
      safeAdd(core.dsos, { url: baseUrl + 'dso' }, 'dsos');
      safeAdd(core.dss, { url: baseUrl + 'surveys/dss' }, 'dss');
      safeAdd(core.milkyway, { url: baseUrl + 'surveys/milkyway' }, 'milkyway');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/moon', key: 'moon' }, 'moon');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/sun', key: 'sun' }, 'sun');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/mercury', key: 'mercury' }, 'mercury');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/venus', key: 'venus' }, 'venus');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/mars', key: 'mars' }, 'mars');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/jupiter', key: 'jupiter' }, 'jupiter');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/saturn', key: 'saturn' }, 'saturn');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/uranus', key: 'uranus' }, 'uranus');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/neptune', key: 'neptune' }, 'neptune');
    };
    setTimeout(loadSecondarySources, 0);

    // Tertiary data sources (loaded during idle time)
    const loadTertiarySources = () => {
      safeAdd(core.minor_planets, { url: baseUrl + 'mpcorb.dat', key: 'mpc_asteroids' }, 'minor_planets');
      safeAdd(core.comets, { url: baseUrl + 'CometEls.txt', key: 'mpc_comets' }, 'comets');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/io', key: 'io' }, 'io');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/europa', key: 'europa' }, 'europa');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/ganymede', key: 'ganymede' }, 'ganymede');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/callisto', key: 'callisto' }, 'callisto');
    };

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(loadTertiarySources);
    } else {
      setTimeout(loadTertiarySources, 500);
    }

    // Apply initial settings - get latest from store to avoid stale closure
    const currentSettings = useSettingsStore.getState().stellarium;
    // Delay initial settings application to ensure engine is fully ready
    setTimeout(() => {
      updateStellariumCore(currentSettings);
      setEngineReady(true);
    }, ENGINE_SETTINGS_INIT_DELAY);

    // Watch for selection changes (guard against callback firing after unmount)
    stel.change((_obj: unknown, attr: string) => {
      if (attr === 'selection') {
        if (!stelRef.current) return;

        const selection = core.selection;
        if (!selection) {
          onSelectionChangeRef.current?.(null);
          return;
        }

        const selectedDesignations = selection.designations();
        const radecVector = selection.getInfo('RADEC') as number[];
        const radecIcrfVec = stel.convertFrame(stel.observer, 'CIRS', 'ICRF', radecVector);
        const radecIcrf = stel.c2s(radecIcrfVec);
        const ra = normalizeRadians(radecIcrf[0]);
        const dec = stel.anpm(radecIcrf[1]);

        onSelectionChangeRef.current?.({
          names: selectedDesignations,
          ra: degreesToHMS(rad2deg(ra)),
          dec: degreesToDMS(rad2deg(dec)),
          raDeg: rad2deg(ra),
          decDeg: rad2deg(dec),
          frame: 'ICRF',
          timeScale: 'UTC',
          qualityFlag: 'precise',
          dataFreshness: 'fallback',
          coordinateSource: 'engine',
          coordinateTimestamp: new Date().toISOString(),
        });
      }
    });
  // Note: stellariumSettings is intentionally NOT in deps - initial settings applied once,
  // subsequent changes handled by useSettingsSync hook.
  // onSelectionChange/onFovChange accessed via refs to keep this callback stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stelRef,
    setStel,
    setBaseUrl,
    setHelpers,
  ]);

  // Load the Stellarium engine script with timeout
  const loadScript = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.StelWebEngine) {
        resolve();
        return;
      }

      // Check if script tag already exists
      const existingScript = document.querySelector(`script[src="${SCRIPT_PATH}"]`);
      if (existingScript) {
        // Script tag exists but StelWebEngine is not set (checked above).
        // The script may have already loaded/errored — event listeners won't re-fire.
        // Remove the stale tag and fall through to create a fresh one.
        logger.warn('Removing stale script tag — StelWebEngine not available');
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.src = SCRIPT_PATH;
      script.async = true;

      const timeoutId = setTimeout(() => {
        script.remove();
        reject(new Error(t('scriptLoadTimedOut')));
      }, SCRIPT_LOAD_TIMEOUT);

      script.onload = () => {
        clearTimeout(timeoutId);
        resolve();
      };

      script.onerror = () => {
        clearTimeout(timeoutId);
        script.remove();
        reject(new Error(t('scriptLoadFailed')));
      };

      document.head.appendChild(script);
    });
  }, [t]);

  // Initialize the Stellarium engine with WASM
  const initializeEngine = useCallback(async (): Promise<void> => {
    if (!canvasRef.current) {
      throw new Error(t('canvasNotAvailable'));
    }

    if (!window.StelWebEngine) {
      throw new Error(t('engineScriptNotLoaded'));
    }

    const currentLanguage = useSettingsStore.getState().stellarium.skyCultureLanguage;
    const translateFn = createStellariumTranslator(currentLanguage);

    // Capture reference after check (TypeScript narrowing)
    const StelWebEngine = window.StelWebEngine;

    return new Promise<void>((resolve, reject) => {
      let resolved = false;

      try {
        // StelWebEngine expects: wasmFile, canvasElement, translateFn, onReady
        const engineResult = StelWebEngine({
          wasmFile: WASM_PATH,
          canvasElement: canvasRef.current!,
          translateFn,
          onReady: (stel: StellariumEngine) => {
            if (resolved) return;
            try {
              initStellarium(stel);
              resolved = true;
              resolve();
            } catch (err) {
              resolved = true;
              reject(err);
            }
          },
        }) as unknown;

        // Handle if StelWebEngine returns a promise (for error handling)
        if (engineResult && typeof (engineResult as Promise<unknown>).then === 'function') {
          (engineResult as Promise<unknown>).catch((err: unknown) => {
            if (!resolved) {
              resolved = true;
              reject(err);
            }
          });
        }
      } catch (err) {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      }
    });
  }, [canvasRef, initStellarium, t]);

  const createStageError = useCallback((stage: LoaderStage, error: unknown): LoaderStageError => {
    const message = error instanceof Error ? error.message : t('loadFailed');
    const stagedError = new Error(message) as LoaderStageError;
    stagedError.stage = stage;
    return stagedError;
  }, [t]);

  // Main loading function with retry support
  const startLoading = useCallback(async () => {
    if (!mountedRef.current) return;

    // Prevent concurrent initialization
    if (initializingRef.current) return;
    initializingRef.current = true;

    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Create abort controller for this load attempt
    abortControllerRef.current?.abort();
    const loadAbortController = new AbortController();
    abortControllerRef.current = loadAbortController;

    // Set loading session window once. Keep the same deadline across retries.
    if (overallDeadlineRef.current === 0) {
      overallDeadlineRef.current = Date.now() + OVERALL_LOADING_TIMEOUT;
      setLoadingStartTime(Date.now());
    }

    if (mountedRef.current) {
      setErrorMessage(null);
      setLoadingErrorCode(null);
      setIsLoading(true);
      setLoadingStatus(t('preparingResources'));
      setLoadingProgress(5);
      setLoadingPhase('preparing');
    }

    let shouldRetry = false;

    try {
      // Step 1: Setup canvas
      if (!canvasRef.current || !containerRef.current) {
        setLoadingStatus(t('canvasContainerNotReady'));
        setLoadingPhase('failed');
        setLoadingErrorCode('container_not_ready');
        shouldRetry = true;
      } else {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          setLoadingStatus(t('canvasContainerNotReady'));
          setLoadingPhase('failed');
          setLoadingErrorCode('container_not_ready');
          shouldRetry = true;
        } else {
          const dpr = getEffectiveDpr(getRenderQuality());
          canvas.width = Math.round(rect.width * dpr);
          canvas.height = Math.round(rect.height * dpr);

          // Step 2: Hint browser to prefetch WASM (non-blocking, no await).
          // The actual WASM fetch is performed by StelWebEngine via
          // WebAssembly.instantiateStreaming; this hint just warms the HTTP cache.
          setLoadingStatus(t('preparingResources'));
          setLoadingProgress(10);
          setLoadingPhase('preparing');
          if (!document.querySelector('link[href$=".wasm"][rel="prefetch"]')) {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.as = 'fetch';
            link.href = WASM_PATH;
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
          }

          // Step 3: Load script
          setLoadingStatus(t('loadingScript'));
          setLoadingProgress(20);
          setLoadingPhase('loading_script');
          try {
            await withTimeout(loadScript(), SCRIPT_LOAD_TIMEOUT, t('engineScriptTimedOut'));
          } catch (error) {
            throw createStageError('script', error);
          }

          // Check if aborted
          if (loadAbortController.signal.aborted || !mountedRef.current) {
            return;
          }

          // Step 4: Initialize WASM engine
          setLoadingStatus(t('initializingStarmap'));
          setLoadingProgress(40);
          setLoadingPhase('initializing_engine');
          try {
            await withTimeout(initializeEngine(), WASM_INIT_TIMEOUT, t('starmapInitTimedOut'));
          } catch (error) {
            throw createStageError('engine', error);
          }

          // Check if aborted
          if (loadAbortController.signal.aborted || !mountedRef.current) {
            return;
          }

          // Success
          if (mountedRef.current) {
            setLoadingProgress(100);
            setIsLoading(false);
            setErrorMessage(null);
            setLoadingErrorCode(null);
            setLoadingPhase('ready');
          }
          retryCountRef.current = 0;
        }
      }

    } catch (err) {
      const stage = err instanceof Error && 'stage' in err
        ? (err as LoaderStageError).stage
        : null;
      if (stage === 'script' || stage === 'engine') {
        logger.error('Error loading star map', err);
      } else {
        logger.warn('Stellarium loader waiting for runtime readiness', err);
      }
      
      // Check if aborted (component unmounted)
      if (loadAbortController.signal.aborted || !mountedRef.current) {
        return;
      }

      const errorMsg = err instanceof Error ? err.message : t('loadFailed');
      
      // Auto-retry if under limit and within overall deadline
      const withinDeadline = Date.now() < overallDeadlineRef.current;
      if (retryCountRef.current < MAX_RETRY_COUNT && withinDeadline) {
        retryCountRef.current++;
        setLoadingStatus(t('retrying', { current: retryCountRef.current, max: MAX_RETRY_COUNT }));
        setLoadingPhase('retrying');
        shouldRetry = true;
      } else {
        // Max retries or overall deadline exceeded
        if (mountedRef.current) {
          const didTimeOut = !withinDeadline;
          setErrorMessage(didTimeOut ? t('overallTimeout') : errorMsg);
          setIsLoading(false);
          setLoadingPhase(didTimeOut ? 'timed_out' : 'failed');
          setLoadingErrorCode(
            didTimeOut
              ? 'overall_timeout'
              : stage === 'script'
                ? errorMsg === t('engineScriptTimedOut')
                  ? 'script_timeout'
                  : 'script_failed'
                : stage === 'engine'
                  ? errorMsg === t('starmapInitTimedOut')
                    ? 'engine_timeout'
                    : 'engine_init_failed'
                  : 'unknown'
          );
        }
      }
    } finally {
      initializingRef.current = false;
    }

    if (shouldRetry && mountedRef.current && !loadAbortController.signal.aborted) {
      const withinDeadline = Date.now() < overallDeadlineRef.current;
      if (!withinDeadline) {
        if (mountedRef.current) {
          setErrorMessage(t('overallTimeout'));
          setIsLoading(false);
          setLoadingPhase('timed_out');
          setLoadingErrorCode('overall_timeout');
        }
      } else if (containerRef.current) {
        // Use ResizeObserver to retry as soon as the container has a non-zero size,
        // instead of a fixed 1s poll delay.
        const obs = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            obs.disconnect();
            if (mountedRef.current && !loadAbortController.signal.aborted) {
              void startLoading();
            }
          }
        });
        obs.observe(containerRef.current);
        // Safety fallback: if observer doesn't fire within RETRY_DELAY_MS, use timeout
        retryTimeoutRef.current = window.setTimeout(() => {
          obs.disconnect();
          retryTimeoutRef.current = null;
          if (mountedRef.current && !loadAbortController.signal.aborted) {
            void startLoading();
          }
        }, RETRY_DELAY_MS);
      } else {
        retryTimeoutRef.current = window.setTimeout(() => {
          retryTimeoutRef.current = null;
          if (mountedRef.current && !loadAbortController.signal.aborted) {
            void startLoading();
          }
        }, RETRY_DELAY_MS);
      }
    }
  }, [containerRef, canvasRef, createStageError, loadScript, initializeEngine, t, getRenderQuality]);

  // Retry loading (user-triggered)
  const handleRetry = useCallback(() => {
    retryCountRef.current = 0;
    overallDeadlineRef.current = 0;
    initializingRef.current = false;
    startLoading();
  }, [startLoading]);

  // Debug: Force reload the engine (clears current engine and restarts)
  const reloadEngine = useCallback(() => {
    logger.debug('Reloading Stellarium engine...');
    
    // Abort any ongoing loading
    abortControllerRef.current?.abort();
    
    // Clear current engine
    if (stelRef.current) {
      (stelRef as React.MutableRefObject<StellariumEngine | null>).current = null;
      setStel(null);
    }
    
    // Remove existing script to force reload
    const existingScript = document.querySelector(`script[src="${SCRIPT_PATH}"]`);
    if (existingScript) {
      existingScript.remove();
    }
    
    // Clear StelWebEngine from window
    delete (window as { StelWebEngine?: unknown }).StelWebEngine;
    
    // Reset state
    setEngineReady(false);
    retryCountRef.current = 0;
    overallDeadlineRef.current = 0;
    initializingRef.current = false;
    
    // Start fresh loading
    startLoading();
  }, [stelRef, startLoading, setStel]);

  return {
    loadingState: {
      isLoading,
      loadingStatus,
      errorMessage,
      startTime: loadingStartTime,
      progress: loadingProgress,
      phase: loadingPhase,
      errorCode: loadingErrorCode,
      retryCount: retryCountRef.current,
    },
    engineReady,
    startLoading,
    handleRetry,
    reloadEngine,
  };
}
