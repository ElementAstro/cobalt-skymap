'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { 
  Crosshair, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Settings,
  Database,
  Globe,
  Cpu,
  ChevronDown,
  History,
  MapPin,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ImageCapture } from './image-capture';
import type { ImageMetadata } from '@/types/starmap/plate-solving';
import { SolverSettings } from './solver-settings';
import { IndexManager } from './index-manager';
import { 
  AstrometryApiClient, 
  createErrorResult,
  persistFileForLocalSolve,
  getProgressText,
  getProgressPercent,
  type SolveProgress,
  type UploadOptions 
} from '@/lib/plate-solving';
import type { PlateSolveResult } from '@/lib/plate-solving';
import type { PlateSolverUnifiedProps, SolveMode } from '@/types/starmap/plate-solving';
import { SolveResultCard } from './solve-result-card';
import { isTauri } from '@/lib/tauri/app-control-api';
import { formatRA, formatDec } from '@/lib/astronomy/coordinates/formats';
import {
  usePlateSolverStore,
  selectActiveSolver,
} from '@/lib/stores/plate-solver-store';
import {
  solveImageLocal,
  convertToLegacyResult,
  isLocalSolver,
  cancelPlateSolve,
  solveOnline,
  DEFAULT_SOLVER_CONFIG,
  type OnlineSolveProgress as TauriOnlineSolveProgress,
  type OnlineSolveResult as TauriOnlineSolveResult,
} from '@/lib/tauri/plate-solver-api';

// Re-export types for backward compatibility
export type { PlateSolverUnifiedProps, SolveMode } from '@/types/starmap/plate-solving';

function toLegacyOnlineResult(online: TauriOnlineSolveResult): PlateSolveResult {
  if (!online.success) {
    return createErrorResult('astrometry.net', online.error_message ?? 'Online plate solve failed');
  }

  const wcs = online.wcs;
  const ra = online.ra ?? wcs?.crval1 ?? null;
  const dec = online.dec ?? wcs?.crval2 ?? null;

  const wcsPixelScale = (() => {
    if (wcs?.cd1_1 !== null && wcs?.cd1_1 !== undefined && wcs?.cd2_1 !== null && wcs?.cd2_1 !== undefined) {
      return Math.sqrt((wcs.cd1_1 ** 2) + (wcs.cd2_1 ** 2)) * 3600;
    }
    if (wcs?.cdelt1 !== null && wcs?.cdelt1 !== undefined) {
      return Math.abs(wcs.cdelt1) * 3600;
    }
    return null;
  })();

  const wcsRotation = (() => {
    if (wcs?.cd1_1 !== null && wcs?.cd1_1 !== undefined && wcs?.cd2_1 !== null && wcs?.cd2_1 !== undefined) {
      return Math.atan2(wcs.cd2_1, wcs.cd1_1) * (180 / Math.PI);
    }
    return wcs?.crota2 ?? wcs?.crota1 ?? null;
  })();

  const wcsFov = (() => {
    if (!wcs?.naxis1 || !wcs?.naxis2) {
      return null;
    }
    if (
      wcs.cd1_1 !== null && wcs.cd1_1 !== undefined &&
      wcs.cd1_2 !== null && wcs.cd1_2 !== undefined &&
      wcs.cd2_1 !== null && wcs.cd2_1 !== undefined &&
      wcs.cd2_2 !== null && wcs.cd2_2 !== undefined
    ) {
      const width = Math.sqrt((wcs.cd1_1 ** 2) + (wcs.cd2_1 ** 2)) * wcs.naxis1;
      const height = Math.sqrt((wcs.cd1_2 ** 2) + (wcs.cd2_2 ** 2)) * wcs.naxis2;
      return { width, height };
    }
    if (
      wcs.cdelt1 !== null && wcs.cdelt1 !== undefined &&
      wcs.cdelt2 !== null && wcs.cdelt2 !== undefined
    ) {
      return {
        width: Math.abs(wcs.cdelt1) * wcs.naxis1,
        height: Math.abs(wcs.cdelt2) * wcs.naxis2,
      };
    }
    return null;
  })();

  const flipped = (() => {
    if (
      wcs?.cd1_1 !== null && wcs?.cd1_1 !== undefined &&
      wcs?.cd1_2 !== null && wcs?.cd1_2 !== undefined &&
      wcs?.cd2_1 !== null && wcs?.cd2_1 !== undefined &&
      wcs?.cd2_2 !== null && wcs?.cd2_2 !== undefined
    ) {
      const det = (wcs.cd1_1 * wcs.cd2_2) - (wcs.cd1_2 * wcs.cd2_1);
      return det > 0;
    }
    if (online.parity !== null && online.parity !== undefined) {
      return online.parity > 0;
    }
    return false;
  })();

  return {
    success: true,
    coordinates: ra !== null && dec !== null ? {
      ra,
      dec,
      raHMS: formatRA(ra),
      decDMS: formatDec(dec),
    } : null,
    positionAngle: online.orientation ?? wcsRotation ?? 0,
    pixelScale: online.pixscale ?? wcsPixelScale ?? 0,
    fov: {
      width: online.fov_width ?? wcsFov?.width ?? 0,
      height: online.fov_height ?? wcsFov?.height ?? 0,
    },
    flipped,
    solverName: 'Astrometry.net (Online)',
    solveTime: online.solve_time_ms,
    errorMessage: online.error_message ?? undefined,
  };
}

function mapTauriProgressToSolveProgress(payload: TauriOnlineSolveProgress): SolveProgress {
  switch (payload.stage) {
    case 'login':
    case 'upload':
      return { stage: 'uploading', progress: Math.max(0, Math.min(100, Math.round(payload.progress))) };
    case 'processing':
      return payload.sub_id !== null
        ? { stage: 'queued', subid: payload.sub_id }
        : { stage: 'uploading', progress: Math.max(0, Math.min(100, Math.round(payload.progress))) };
    case 'solving':
    case 'fetching':
    case 'complete':
      return { stage: 'processing', jobId: payload.job_id ?? 0 };
    default:
      return { stage: 'uploading', progress: Math.max(0, Math.min(100, Math.round(payload.progress))) };
  }
}

// ============================================================================
// Component
// ============================================================================

export function PlateSolverUnified({ 
  onSolveComplete, 
  onGoToCoordinates,
  trigger, 
  className,
  defaultImagePath,
  raHint,
  decHint,
  fovHint,
}: PlateSolverUnifiedProps) {
  const t = useTranslations();
  const isDesktop = isTauri();
  
  // Store state
  const {
    config: storeConfig,
    onlineApiKey,
    detectSolvers,
    setOnlineApiKey,
    loadConfig,
    addToHistory,
    solveHistory,
    clearHistory,
  } = usePlateSolverStore();
  const config = storeConfig ?? DEFAULT_SOLVER_CONFIG;
  const activeSolver = usePlateSolverStore(selectActiveSolver);
  const canSolveLocal = usePlateSolverStore((state) => {
    const active = selectActiveSolver(state);
    if (!active) return false;
    if (active.solver_type === 'astrometry_net_online') return false;
    return active.is_available && active.installed_indexes.length > 0;
  });

  // Cancel ref for online solve
  const cancelClientRef = useRef<AstrometryApiClient | null>(null);

  // Ref to hold latest handleImageCapture for use in effects without stale closures
  const handleImageCaptureRef = useRef<((file: File, metadata?: ImageMetadata) => Promise<void>) | undefined>(undefined);

  // Local state
  const [open, setOpen] = useState(false);
  const [solveMode, setSolveMode] = useState<SolveMode>(isDesktop ? 'local' : 'online');
  const [solving, setSolving] = useState(false);
  const [progress, setProgress] = useState<SolveProgress | null>(null);
  const [localProgress, setLocalProgress] = useState<number>(0);
  const [localMessage, setLocalMessage] = useState<string>('');
  const [result, setResult] = useState<PlateSolveResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [options, setOptions] = useState<Partial<UploadOptions>>({
    downsampleFactor: 2,
    publiclyVisible: 'n',
  });

  // Initialize on open
  useEffect(() => {
    if (open && isDesktop) {
      detectSolvers();
      loadConfig();
    }
  }, [open, isDesktop, detectSolvers, loadConfig]);

  // Auto-load default image when dialog opens with a defaultImagePath
  useEffect(() => {
    if (open && defaultImagePath && isDesktop && !solving) {
      (async () => {
        try {
          const { readFile } = await import('@tauri-apps/plugin-fs');
          const data = await readFile(defaultImagePath);
          const fileName = defaultImagePath.split(/[/\\]/).pop() || 'image';
          const file = new File([data], fileName);
          handleImageCaptureRef.current?.(file);
        } catch {
          // Silently ignore if the file cannot be read
        }
      })();
    }
  }, [open, defaultImagePath, isDesktop, solving]);

  // Handle local solve
  const handleLocalSolve = useCallback(async (file: File, effectiveRaHint?: number, effectiveDecHint?: number) => {
    if (!isDesktop) return;
    if (config.solver_type === 'astrometry_net_online') {
      setResult(createErrorResult(
        activeSolver?.name || t('plateSolving.localSolverFallback'),
        t('plateSolving.localSolverNotReady') || 'Local solver not ready.',
      ));
      return;
    }
    if (!canSolveLocal) return;

    setSolving(true);
    setResult(null);
    setLocalProgress(5);
    setLocalMessage(t('plateSolving.preparing') || 'Preparing...');

    // Listen for solve-progress events from Rust backend
    let unlistenProgress: (() => void) | null = null;
    try {
      const { listen } = await import('@tauri-apps/api/event');
      unlistenProgress = await listen<{ stage: string; progress: number; message: string }>(
        'solve-progress',
        (event) => {
          const { stage, progress: pct, message } = event.payload;
          setLocalProgress(pct);
          // Use i18n keys when available, fall back to backend message
          const stageKey = `plateSolving.${stage}` as const;
          setLocalMessage(t(stageKey) || message);
        }
      );
    } catch {
      // listen not available (web mode) — continue with static progress
    }

    let cleanup: undefined | (() => Promise<void>);

    try {
      const persisted = await persistFileForLocalSolve(file);
      cleanup = persisted.cleanup;

      setLocalProgress(10);
      setLocalMessage(t('plateSolving.solving') || 'Solving...');

      const solveResult = await solveImageLocal(
        config,
        {
          image_path: persisted.filePath,
          ra_hint: effectiveRaHint ?? raHint ?? null,
          dec_hint: effectiveDecHint ?? decHint ?? null,
          fov_hint: fovHint ?? null,
          search_radius: config.search_radius,
          downsample: config.downsample,
          timeout: config.timeout_seconds,
        }
      );

      setLocalProgress(100);
      setLocalMessage(solveResult.success 
        ? (t('plateSolving.success') || 'Success!') 
        : (t('plateSolving.failed') || 'Failed'));

      const legacyResult = convertToLegacyResult(solveResult);
      setResult(legacyResult);
      addToHistory({ imageName: file.name, solveMode: 'local', result: legacyResult });
      onSolveComplete?.(legacyResult);
    } catch (error) {
      setLocalProgress(100);
      setLocalMessage(t('plateSolving.failed') || 'Failed');
      const errorResult = createErrorResult(
        activeSolver?.name || t('plateSolving.localSolverFallback'),
        error instanceof Error ? error.message : t('plateSolving.unknownError'),
      );
      setResult(errorResult);
      addToHistory({ imageName: file.name, solveMode: 'local', result: errorResult });
    } finally {
      unlistenProgress?.();
      if (cleanup) {
        cleanup().catch(() => {});
      }
      setSolving(false);
    }
  }, [isDesktop, canSolveLocal, config, raHint, decHint, fovHint, activeSolver, onSolveComplete, addToHistory, t]);

  // Handle online solve with optional retry logic
  const handleOnlineSolve = useCallback(async (file: File, effectiveRaHint?: number, effectiveDecHint?: number) => {
    if (!onlineApiKey) return;

    setSolving(true);
    setResult(null);
    setProgress({ stage: 'uploading', progress: 0 });

    const maxAttempts = config?.retry_on_failure ? (config.max_retries + 1) : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let unlistenProgress: (() => void) | null = null;
      let cleanup: undefined | (() => Promise<void>);
      try {
        const effectiveOptions = { ...options };
        if (effectiveRaHint !== undefined && effectiveDecHint !== undefined) {
          effectiveOptions.centerRa = effectiveRaHint;
          effectiveOptions.centerDec = effectiveDecHint;
          effectiveOptions.radius = config?.search_radius ?? 30;
        }
        if (attempt > 0 && effectiveOptions.downsampleFactor) {
          effectiveOptions.downsampleFactor = Math.min(effectiveOptions.downsampleFactor + attempt, 4);
        }

        if (isDesktop) {
          const { listen } = await import('@tauri-apps/api/event');
          unlistenProgress = await listen<TauriOnlineSolveProgress>('astrometry-progress', (event) => {
            setProgress(mapTauriProgressToSolveProgress(event.payload));
          });

          const persisted = await persistFileForLocalSolve(file);
          cleanup = persisted.cleanup;

          const onlineResult = await solveOnline({
            api_key: onlineApiKey,
            image_path: persisted.filePath,
            ra_hint: effectiveOptions.centerRa,
            dec_hint: effectiveOptions.centerDec,
            radius: effectiveOptions.radius,
            scale_units: effectiveOptions.scaleUnits,
            scale_lower: effectiveOptions.scaleLower,
            scale_upper: effectiveOptions.scaleUpper,
            scale_est: effectiveOptions.scaleEst,
            scale_err: effectiveOptions.scaleErr,
            downsample_factor: effectiveOptions.downsampleFactor,
            tweak_order: effectiveOptions.tweakOrder,
            crpix_center: effectiveOptions.crpixCenter,
            parity: effectiveOptions.parity,
            timeout_seconds: config?.timeout_seconds,
            publicly_visible: effectiveOptions.publiclyVisible === 'y',
          });

          const solveResult = toLegacyOnlineResult(onlineResult);
          if (solveResult.success || attempt >= maxAttempts - 1) {
            setProgress({ stage: 'success', result: solveResult });
            setResult(solveResult);
            addToHistory({ imageName: file.name, solveMode: 'online', result: solveResult });
            onSolveComplete?.(solveResult);
            break;
          }
        } else {
          const client = new AstrometryApiClient({ apiKey: onlineApiKey });
          cancelClientRef.current = client;
          const solveResult = await client.solve(file, effectiveOptions, setProgress);
          if (solveResult.success || attempt >= maxAttempts - 1) {
            setResult(solveResult);
            addToHistory({ imageName: file.name, solveMode: 'online', result: solveResult });
            onSolveComplete?.(solveResult);
            break;
          }
        }

        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        setProgress({ stage: 'uploading', progress: 0 });
      } catch (error) {
        if (attempt >= maxAttempts - 1) {
          const errorResult = createErrorResult(
            'astrometry.net',
            error instanceof Error ? error.message : t('plateSolving.unknownError'),
          );
          setResult(errorResult);
          addToHistory({ imageName: file.name, solveMode: 'online', result: errorResult });
        } else {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          setProgress({ stage: 'uploading', progress: 0 });
        }
      } finally {
        unlistenProgress?.();
        if (cleanup) {
          cleanup().catch(() => {});
        }
      }
    }

    cancelClientRef.current = null;
    setSolving(false);
  }, [onlineApiKey, options, onSolveComplete, config, addToHistory, t, isDesktop]);

  // Handle image capture with optional FITS WCS hints
  const handleImageCapture = useCallback(async (file: File, metadata?: ImageMetadata) => {
    // Extract WCS hints from FITS metadata when auto_hints is enabled and no explicit hints provided
    let effectiveRaHint = raHint;
    let effectiveDecHint = decHint;
    if (config?.auto_hints && metadata?.fitsData?.wcs && !raHint && !decHint) {
      const wcs = metadata.fitsData.wcs;
      effectiveRaHint = wcs.referenceCoordinates.ra;
      effectiveDecHint = wcs.referenceCoordinates.dec;
    }

    if (solveMode === 'local' && isDesktop) {
      await handleLocalSolve(file, effectiveRaHint, effectiveDecHint);
    } else {
      await handleOnlineSolve(file, effectiveRaHint, effectiveDecHint);
    }
  }, [solveMode, isDesktop, handleLocalSolve, handleOnlineSolve, config, raHint, decHint]);

  // Keep ref in sync with latest handleImageCapture
  handleImageCaptureRef.current = handleImageCapture;

  // Handle cancel solve
  const handleCancelSolve = useCallback(async () => {
    if (solveMode === 'local' && isDesktop) {
      try { await cancelPlateSolve(); } catch { /* ignore */ }
    } else {
      cancelClientRef.current?.cancel();
      cancelClientRef.current = null;
    }
    setSolving(false);
    setResult(createErrorResult(
      solveMode === 'local' ? (activeSolver?.name || t('plateSolving.localSolverFallback')) : 'astrometry.net',
      t('plateSolving.cancelled') || 'Solve cancelled by user',
    ));
  }, [solveMode, isDesktop, activeSolver, t]);

  // Handle go to coordinates
  const handleGoTo = useCallback(() => {
    if (result?.success && result.coordinates) {
      onGoToCoordinates?.(result.coordinates.ra, result.coordinates.dec);
      setOpen(false);
    }
  }, [result, onGoToCoordinates]);

  // Progress text/percent delegated to lib/plate-solving/solve-utils
  const progressText = getProgressText(progress, t);
  const progressPercent = getProgressPercent(solveMode, localProgress, progress);

  // Can solve check
  const canSolve = solveMode === 'local' ? canSolveLocal : !!onlineApiKey;

  // Get solver icon
  const getSolverIcon = () => {
    if (solveMode === 'online') return <Globe className="h-4 w-4" />;
    return <Cpu className="h-4 w-4" />;
  };

  // Shared API key input section
  const renderApiKeyInput = () => (
    <div className="space-y-2">
      <Label htmlFor="apiKey">
        {t('plateSolving.apiKey') || 'Astrometry.net API Key'}
      </Label>
      <Input
        id="apiKey"
        type="password"
        value={onlineApiKey}
        onChange={(e) => setOnlineApiKey(e.target.value)}
        placeholder={t('plateSolving.apiKeyPlaceholder') || 'Enter your API key'}
      />
      <p className="text-xs text-muted-foreground">
        {t('plateSolving.apiKeyHint') || 'Get your free API key at nova.astrometry.net'}
      </p>
    </div>
  );

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className={cn("h-9 w-9", className)}>
            <Crosshair className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5" />
            {t('plateSolving.title') || 'Plate Solving'}
          </DialogTitle>
          <DialogDescription>
            {t('plateSolving.description') || 'Upload an astronomical image to determine its sky coordinates'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode Selection (Desktop only) */}
          {isDesktop && (
            <Tabs value={solveMode} onValueChange={(v) => setSolveMode(v as SolveMode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="local" className="flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  {t('plateSolving.localSolver') || 'Local'}
                </TabsTrigger>
                <TabsTrigger value="online" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {t('plateSolving.onlineSolver') || 'Online'}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="local" className="space-y-4 mt-4">
                {/* Active Solver Info */}
                {activeSolver && (
                  <Card className="py-3 gap-0">
                    <CardContent className="flex items-center justify-between px-4 py-0">
                      <div className="flex items-center gap-2">
                        {getSolverIcon()}
                        <div>
                          <div className="font-medium text-sm">{activeSolver.name}</div>
                          {activeSolver.version && (
                            <div className="text-xs text-muted-foreground">{activeSolver.version}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeSolver.is_available ? (
                          <Badge variant="default" className="bg-green-600 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {t('plateSolving.ready') || 'Ready'}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            {t('plateSolving.notInstalled') || 'Not Installed'}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setShowSettings(true)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Index Status */}
                {activeSolver && isLocalSolver(config.solver_type) && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {activeSolver.installed_indexes.length}{' '}
                        {t('plateSolving.indexesInstalled') || 'indexes installed'}
                      </span>
                    </div>
                    <IndexManager solverType={config.solver_type} />
                  </div>
                )}

                {/* Warning if not ready */}
                {!canSolveLocal && (
                  <Alert>
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      {t('plateSolving.localSolverNotReady') || 
                        'Local solver not ready. Install a solver and download index files.'}
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="online" className="space-y-4 mt-4">
                {renderApiKeyInput()}
              </TabsContent>
            </Tabs>
          )}

          {/* Online-only mode for web */}
          {!isDesktop && renderApiKeyInput()}

          {/* Advanced Options */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  {t('plateSolving.advancedOptions') || 'Advanced Options'}
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvanced && 'rotate-180')} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="downsample" className="text-xs">
                    {t('plateSolving.downsample') || 'Downsample Factor'}
                  </Label>
                  <Input
                    id="downsample"
                    type="number"
                    min={0}
                    max={8}
                    value={solveMode === 'local' ? config.downsample : (options.downsampleFactor || 2)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      if (solveMode === 'local') {
                        usePlateSolverStore.getState().setConfig({ downsample: val });
                      } else {
                        setOptions(prev => ({ ...prev, downsampleFactor: val }));
                      }
                    }}
                    placeholder={t('plateSolving.autoPlaceholder')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="radius" className="text-xs">
                    {t('plateSolving.searchRadius') || 'Search Radius (°)'}
                  </Label>
                  <Input
                    id="radius"
                    type="number"
                    min={0}
                    max={180}
                    value={solveMode === 'local' ? config.search_radius : (options.radius || '')}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 30;
                      if (solveMode === 'local') {
                        usePlateSolverStore.getState().setConfig({ search_radius: val });
                      } else {
                        setOptions(prev => ({ ...prev, radius: val }));
                      }
                    }}
                    placeholder="30"
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Image Selection & Solve */}
          <ImageCapture 
            onImageCapture={handleImageCapture}
            trigger={
              <Button 
                className="w-full" 
                disabled={!canSolve || solving}
              >
                {solving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('plateSolving.solving') || 'Solving...'}
                  </>
                ) : (
                  <>
                    <Crosshair className="h-4 w-4 mr-2" />
                    {t('plateSolving.selectImage') || 'Select Image to Solve'}
                  </>
                )}
              </Button>
            }
          />

          {/* Progress */}
          {solving && (
            <div className="space-y-2">
              <Progress value={progressPercent} />
              <p className="text-sm text-center text-muted-foreground">
                {solveMode === 'local' ? localMessage : progressText}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleCancelSolve}
              >
                <XCircle className="h-4 w-4 mr-2" />
                {t('plateSolving.cancel') || 'Cancel'}
              </Button>
            </div>
          )}

          {/* Result */}
          {result && (
            <SolveResultCard
              result={result}
              onGoTo={onGoToCoordinates ? handleGoTo : undefined}
            />
          )}

          {/* Solve History */}
          {solveHistory.length > 0 && !solving && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    {t('plateSolving.solveHistory') || 'Solve History'} ({solveHistory.length})
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScrollArea className="max-h-48 mt-2">
                  <div className="space-y-1">
                    {solveHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between text-xs p-2 rounded border bg-muted/30"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {entry.result.success ? (
                            <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="truncate font-medium">{entry.imageName}</div>
                            <div className="text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleString()} · {entry.solveMode}
                              {entry.result.success && entry.result.coordinates && (
                                <span className="ml-1">
                                  · {entry.result.coordinates.raHMS}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {entry.result.success && entry.result.coordinates && onGoToCoordinates && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={() => {
                                  onGoToCoordinates(entry.result.coordinates!.ra, entry.result.coordinates!.dec);
                                  setOpen(false);
                                }}
                              >
                                <MapPin className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('plateSolving.goToPosition') || 'Go to Position'}</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-destructive hover:text-destructive"
                  onClick={clearHistory}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  {t('plateSolving.clearHistory') || 'Clear History'}
                </Button>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

      </DialogContent>
    </Dialog>

    {/* Settings Sheet */}
    <Sheet open={showSettings} onOpenChange={setShowSettings}>
      <SheetContent side="right" className="sm:max-w-[500px] p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>
            {t('plateSolving.solverSettings') || 'Solver Settings'}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-5rem)]">
          <div className="p-4">
            <SolverSettings onClose={() => setShowSettings(false)} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
    </>
  );
}

export default PlateSolverUnified;
