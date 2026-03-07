'use client';

import { useState, useMemo, useCallback, useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StatCard } from './stat-card';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CalendarClock,
  CalendarDays,
  Clock,
  Moon,
  Sun,
  Target,
  ArrowRight,
  AlertTriangle,
  Info,
  ChevronDown,
  Sparkles,
  Wand2,
  ListOrdered,
  Timer,
  Eye,
  EyeOff,
  Save,
  FolderOpen,
  Trash2,
  GripVertical,
  Lock,
  Unlock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMountStore, useStellariumStore, useEquipmentStore, useSessionPlanStore, usePlanningUiStore } from '@/lib/stores';
import { useTargetListStore, type TargetItem } from '@/lib/stores/target-list-store';
import { degreesToHMS, degreesToDMS } from '@/lib/astronomy/starmap-utils';
import {
  calculateTwilightTimes,
  getMoonPhase,
  getMoonPhaseName,
  getMoonIllumination,
  formatTimeShort,
  formatDuration,
  getJulianDateFromDate,
  type TwilightTimes,
} from '@/lib/astronomy/astro-utils';
import { optimizeScheduleV2 } from '@/lib/astronomy/session-scheduler-v2';
import { exportSessionPlan } from '@/lib/astronomy/plan-exporter';
import type { ScheduledTarget, SessionPlan, OptimizationStrategy } from '@/types/starmap/planning';
import type {
  ManualScheduleItem,
  SessionConstraintSet,
  SessionDraftV2,
  SessionPlanV2,
  SessionWeatherSnapshot,
} from '@/types/starmap/session-planner-v2';
import { MountSafetySimulator } from './mount-safety-simulator';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { isTauri } from '@/lib/storage/platform';
import { tauriApi, mountApi } from '@/lib/tauri';
import type { SavedSessionPlan, SavedSessionTemplate } from '@/lib/stores';
import type { ObservingConditions, SafetyState } from '@/lib/tauri/mount-api';

// ============================================================================
// Timeline Component
// ============================================================================

interface TimelineProps {
  plan: SessionPlan;
  twilight: TwilightTimes;
  onTargetClick: (target: TargetItem) => void;
  showGaps: boolean;
}

function isSessionDraftV2(value: unknown): value is SessionDraftV2 {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<SessionDraftV2>;
  return (
    typeof draft.planDate === 'string'
    && typeof draft.strategy === 'string'
    && typeof draft.constraints === 'object'
    && Array.isArray(draft.excludedTargetIds)
    && Array.isArray(draft.manualEdits)
  );
}

function SessionTimeline({ plan, twilight, onTargetClick, showGaps }: TimelineProps) {
  const t = useTranslations();
  
  if (!twilight.astronomicalDusk || !twilight.astronomicalDawn) {
    return (
      <div className="text-center text-muted-foreground py-4">
        {t('sessionPlanner.noNightTonight')}
      </div>
    );
  }
  
  const nightStart = twilight.astronomicalDusk.getTime();
  const nightEnd = twilight.astronomicalDawn.getTime();
  const nightDuration = nightEnd - nightStart;
  
  const getPosition = (time: Date) => {
    return ((time.getTime() - nightStart) / nightDuration) * 100;
  };
  
  const getWidth = (start: Date, end: Date) => {
    return ((end.getTime() - start.getTime()) / nightDuration) * 100;
  };
  
  // Color palette for targets
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500',
    'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
  ];
  
  return (
    <div className="space-y-3">
      {/* Time markers */}
      <div className="relative h-6">
        <div className="absolute left-0 text-xs text-muted-foreground">
          {formatTimeShort(twilight.astronomicalDusk)}
        </div>
        <div className="absolute left-1/4 -translate-x-1/2 text-xs text-muted-foreground">
          {formatTimeShort(new Date(nightStart + nightDuration * 0.25))}
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
          {formatTimeShort(new Date(nightStart + nightDuration * 0.5))}
        </div>
        <div className="absolute left-3/4 -translate-x-1/2 text-xs text-muted-foreground">
          {formatTimeShort(new Date(nightStart + nightDuration * 0.75))}
        </div>
        <div className="absolute right-0 text-xs text-muted-foreground">
          {formatTimeShort(twilight.astronomicalDawn)}
        </div>
      </div>
      
      {/* Timeline bar */}
      <div className="relative h-12 bg-muted/50 rounded-lg overflow-hidden">
        {/* Twilight zones */}
        {twilight.nauticalDusk && twilight.astronomicalDusk && (
          <div 
            className="absolute top-0 bottom-0 bg-indigo-900/30"
            style={{ 
              left: 0, 
              width: `${getPosition(twilight.astronomicalDusk)}%` 
            }}
          />
        )}
        {twilight.nauticalDawn && twilight.astronomicalDawn && (
          <div 
            className="absolute top-0 bottom-0 bg-indigo-900/30"
            style={{ 
              left: `${getPosition(twilight.astronomicalDawn)}%`, 
              right: 0 
            }}
          />
        )}
        
        {/* Gaps */}
        {showGaps && plan.gaps.map((gap, i) => (
          <div
            key={`gap-${i}`}
            className="absolute top-0 bottom-0 bg-red-900/20 border-x border-red-500/30"
            data-testid="session-gap"
            style={{
              left: `${getPosition(gap.start)}%`,
              width: `${getWidth(gap.start, gap.end)}%`,
            }}
          />
        ))}
        
        {/* Scheduled targets */}
        {plan.targets.map((scheduled, i) => (
          <Tooltip key={scheduled.target.id}>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  'absolute top-1 bottom-1 rounded cursor-pointer transition-all hover:ring-2 ring-white/50',
                  colors[i % colors.length],
                  scheduled.isOptimal ? 'opacity-100' : 'opacity-70'
                )}
                style={{
                  left: `${getPosition(scheduled.startTime)}%`,
                  width: `${Math.max(getWidth(scheduled.startTime, scheduled.endTime), 2)}%`,
                }}
                onClick={() => onTargetClick(scheduled.target)}
              >
                <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-medium truncate px-1">
                  {scheduled.target.name}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm">
                <div className="font-medium">{scheduled.target.name}</div>
                <div className="text-muted-foreground">
                  {formatTimeShort(scheduled.startTime)} - {formatTimeShort(scheduled.endTime)}
                </div>
                <div className="text-muted-foreground">
                  {formatDuration(scheduled.duration)} • {t('sessionPlanner.maxAlt', { value: scheduled.maxAltitude.toFixed(0) })}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
        
        {/* Current time marker */}
        {(() => {
          const now = new Date();
          if (now.getTime() >= nightStart && now.getTime() <= nightEnd) {
            return (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                style={{ left: `${getPosition(now)}%` }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full" />
              </div>
            );
          }
          return null;
        })()}
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {plan.targets.map((scheduled, i) => (
          <Badge
            key={scheduled.target.id}
            variant="outline"
            className={cn(
              'text-xs cursor-pointer',
              colors[i % colors.length].replace('bg-', 'border-')
            )}
            onClick={() => onTargetClick(scheduled.target)}
          >
            <span className={cn('w-2 h-2 rounded-full mr-1', colors[i % colors.length])} />
            {scheduled.target.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Scheduled Target Card
// ============================================================================

interface TargetCardProps {
  scheduled: ScheduledTarget;
  onNavigate: () => void;
  onExclude: () => void;
}

function ScheduledTargetCard({ scheduled, onNavigate, onExclude }: TargetCardProps) {
  const t = useTranslations();
  
  return (
    <Collapsible>
    <div className={cn(
      'border rounded-lg p-3 transition-colors',
      scheduled.isOptimal ? 'border-green-500/30 bg-green-500/5' : 'border-border'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-primary">{scheduled.order}</span>
            <Badge variant={scheduled.isOptimal ? 'default' : 'secondary'} className="text-[10px]">
              {scheduled.feasibility.score}
            </Badge>
          </div>
          <div>
            <div className="font-medium">{scheduled.target.name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Clock className="h-3 w-3" />
              {formatTimeShort(scheduled.startTime)} - {formatTimeShort(scheduled.endTime)}
              <span className="text-foreground">({formatDuration(scheduled.duration)})</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNavigate}>
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('actions.goToTarget')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500 hover:text-amber-400" onClick={onExclude}>
                <EyeOff className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('sessionPlanner.excludeFromPlan')}</TooltipContent>
          </Tooltip>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 [&[data-state=open]>svg]:rotate-180 transition-transform">
              <ChevronDown className="h-3.5 w-3.5 transition-transform" />
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>
      
      {/* Quick stats */}
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Target className="h-3 w-3" />
          {t('sessionPlanner.maxAlt', { value: scheduled.maxAltitude.toFixed(0) })}
        </span>
        <span className="flex items-center gap-1">
          <Moon className="h-3 w-3" />
          {t('sessionPlanner.fromMoon', { value: scheduled.moonDistance.toFixed(0) })}
        </span>
        {scheduled.transitTime && (
          <span className="flex items-center gap-1">
            <ArrowRight className="h-3 w-3" />
            {t('sessionPlanner.transitAt', { time: formatTimeShort(scheduled.transitTime) })}
          </span>
        )}
      </div>
      
      {/* Expanded details */}
      <CollapsibleContent>
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">RA:</span>{' '}
              <span className="font-mono">{degreesToHMS(scheduled.target.ra)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Dec:</span>{' '}
              <span className="font-mono">{degreesToDMS(scheduled.target.dec)}</span>
            </div>
          </div>
          
          {/* Feasibility breakdown */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('feasibility.moon')}</span>
              <Progress value={scheduled.feasibility.moonScore} className="w-20 h-1.5" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('feasibility.altitude')}</span>
              <Progress value={scheduled.feasibility.altitudeScore} className="w-20 h-1.5" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('feasibility.duration')}</span>
              <Progress value={scheduled.feasibility.durationScore} className="w-20 h-1.5" />
            </div>
          </div>
          
          {/* Conflicts */}
          {scheduled.conflicts.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-500">
              <AlertTriangle className="h-3 w-3 mt-0.5" />
              <span>{t('sessionPlanner.overlapsWith', { list: scheduled.conflicts.join(', ') })}</span>
            </div>
          )}
          
          {/* Tips */}
          {scheduled.feasibility.tips.length > 0 && (
            <div className="space-y-1">
              {scheduled.feasibility.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3 mt-0.5" />
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </div>
    </Collapsible>
  );
}

interface SortableTargetCardProps {
  scheduled: ScheduledTarget;
  children: ReactNode;
}

function SortableTargetCard({ scheduled, children }: SortableTargetCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scheduled.target.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'opacity-60')}
      data-testid={`session-schedule-item-${scheduled.target.id}`}
    >
      <div className="flex items-start gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 mt-2 shrink-0 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          data-testid={`session-drag-handle-${scheduled.target.id}`}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </Button>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SessionPlanner() {
  const t = useTranslations();
  const open = usePlanningUiStore((state) => state.sessionPlannerOpen);
  const setOpen = usePlanningUiStore((state) => state.setSessionPlannerOpen);
  const openShotList = usePlanningUiStore((state) => state.openShotList);
  const openTonightRecommendations = usePlanningUiStore((state) => state.openTonightRecommendations);
  const [strategy, setStrategy] = useState<OptimizationStrategy>('balanced');
  const [planningMode, setPlanningMode] = useState<'auto' | 'manual'>('auto');
  const [minAltitude, setMinAltitude] = useState(30);
  const [minImagingTime, setMinImagingTime] = useState(30); // minutes
  const [minMoonDistance, setMinMoonDistance] = useState(20);
  const [useExposurePlanDuration, setUseExposurePlanDuration] = useState(true);
  const [sessionWindowStartTime, setSessionWindowStartTime] = useState('');
  const [sessionWindowEndTime, setSessionWindowEndTime] = useState('');
  const [enforceMountSafety, setEnforceMountSafety] = useState(false);
  const [avoidMeridianFlipWindow, setAvoidMeridianFlipWindow] = useState(false);
  const [showGaps, setShowGaps] = useState(true);
  const [planDate, setPlanDate] = useState<Date>(new Date());
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [manualEdits, setManualEdits] = useState<Record<string, ManualScheduleItem>>({});
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [weatherInput, setWeatherInput] = useState<{
    cloudCover?: number;
    humidity?: number;
    windSpeed?: number;
    dewPoint?: number;
  }>({});
  const [deviceWeather, setDeviceWeather] = useState<ObservingConditions | null>(null);
  const [safetyState, setSafetyState] = useState<SafetyState | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [remoteTemplates, setRemoteTemplates] = useState<SavedSessionTemplate[]>([]);
  
  const profileInfo = useMountStore((state) => state.profileInfo);
  const mountConnected = useMountStore((state) => state.mountInfo.Connected ?? false);
  const mountSafetyConfig = useMountStore((state) => state.safetyConfig);
  const setViewDirection = useStellariumStore((state) => state.setViewDirection);
  const targets = useTargetListStore((state) => state.targets);
  const setActiveTarget = useTargetListStore((state) => state.setActiveTarget);
  const addTargetsBatch = useTargetListStore((state) => state.addTargetsBatch);
  
  // Session plan persistence
  const savedPlans = useSessionPlanStore((state) => state.savedPlans);
  const savePlan = useSessionPlanStore((state) => state.savePlan);
  const templates = useSessionPlanStore((state) => state.templates);
  const saveTemplate = useSessionPlanStore((state) => state.saveTemplate);
  const loadTemplate = useSessionPlanStore((state) => state.loadTemplate);
  const importPlanV2 = useSessionPlanStore((state) => state.importPlanV2);
  const deleteSavedPlan = useSessionPlanStore((state) => state.deletePlan);
  const executions = useSessionPlanStore((state) => state.executions);
  const activeExecutionId = useSessionPlanStore((state) => state.activeExecutionId);
  const syncExecutionFromObservationSession = useSessionPlanStore((state) => state.syncExecutionFromObservationSession);
  const setActiveExecution = useSessionPlanStore((state) => state.setActiveExecution);
  const createExecutionFromPlan = useSessionPlanStore((state) => state.createExecutionFromPlan);
  const [showSavedPlans, setShowSavedPlans] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  
  // Equipment profile
  const focalLength = useEquipmentStore((state) => state.focalLength);
  const aperture = useEquipmentStore((state) => state.aperture);
  const sensorWidth = useEquipmentStore((state) => state.sensorWidth);
  const sensorHeight = useEquipmentStore((state) => state.sensorHeight);
  
  const latitude = profileInfo.AstrometrySettings.Latitude || 0;
  const longitude = profileInfo.AstrometrySettings.Longitude || 0;
  
  // Calculate FOV
  const fovWidth = sensorWidth && focalLength ? (sensorWidth / focalLength) * 57.3 : 0;
  const fovHeight = sensorHeight && focalLength ? (sensorHeight / focalLength) * 57.3 : 0;
  
  const twilight = useMemo(
    () => calculateTwilightTimes(latitude, longitude, planDate),
    [latitude, longitude, planDate]
  );
  
  const planJd = useMemo(() => getJulianDateFromDate(planDate), [planDate]);
  const moonPhase = getMoonPhase(planJd);
  const moonIllum = getMoonIllumination(moonPhase);
  
  // Filter active targets (not archived)
  const activeTargets = useMemo(
    () => targets.filter(t => !t.isArchived && t.status !== 'completed'),
    [targets]
  );

  const weatherSnapshot = useMemo<SessionWeatherSnapshot | undefined>(() => {
    const capturedAt = new Date().toISOString();
    const hasDeviceWeather = deviceWeather
      ? Object.values(deviceWeather).some((value) => typeof value === 'number' && Number.isFinite(value))
      : false;
    if (hasDeviceWeather && deviceWeather) {
      return {
        cloudCover: deviceWeather.cloudCover,
        humidity: deviceWeather.humidity,
        windSpeed: deviceWeather.windSpeed,
        dewPoint: deviceWeather.dewPoint,
        source: 'device',
        capturedAt,
      };
    }

    const hasManualWeather = Object.values(weatherInput).some(
      (value) => typeof value === 'number' && Number.isFinite(value),
    );
    if (hasManualWeather) {
      return {
        ...weatherInput,
        source: 'manual',
        capturedAt,
      };
    }

    return undefined;
  }, [deviceWeather, weatherInput]);

  const availableTemplates = useMemo<SavedSessionTemplate[]>(() => {
    if (remoteTemplates.length === 0) return templates;
    const byId = new Map<string, SavedSessionTemplate>();
    for (const template of [...templates, ...remoteTemplates]) {
      byId.set(template.id, template);
    }
    return Array.from(byId.values()).sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
  }, [remoteTemplates, templates]);

  const constraints = useMemo<SessionConstraintSet>(() => ({
    minAltitude,
    minImagingTime,
    minMoonDistance,
    sessionWindow: sessionWindowStartTime && sessionWindowEndTime
      ? { startTime: sessionWindowStartTime, endTime: sessionWindowEndTime }
      : undefined,
    useExposurePlanDuration,
    weatherLimits: {
      maxCloudCover: 70,
      maxHumidity: 90,
      maxWindSpeed: 25,
    },
    safetyLimits: {
      enforceMountSafety,
      avoidMeridianFlipWindow: enforceMountSafety ? avoidMeridianFlipWindow : false,
    },
  }), [
    avoidMeridianFlipWindow,
    enforceMountSafety,
    minAltitude,
    minImagingTime,
    minMoonDistance,
    sessionWindowEndTime,
    sessionWindowStartTime,
    useExposurePlanDuration,
  ]);

  const applyDraft = useCallback((draft: SessionDraftV2) => {
    setPlanDate(new Date(draft.planDate));
    setStrategy(draft.strategy);
    setMinAltitude(draft.constraints.minAltitude);
    setMinImagingTime(draft.constraints.minImagingTime);
    setMinMoonDistance(draft.constraints.minMoonDistance ?? 20);
    setUseExposurePlanDuration(draft.constraints.useExposurePlanDuration ?? true);
    setSessionWindowStartTime(draft.constraints.sessionWindow?.startTime ?? '');
    setSessionWindowEndTime(draft.constraints.sessionWindow?.endTime ?? '');
    const nextEnforceMountSafety = Boolean(draft.constraints.safetyLimits?.enforceMountSafety);
    setEnforceMountSafety(nextEnforceMountSafety);
    setAvoidMeridianFlipWindow(
      nextEnforceMountSafety && Boolean(draft.constraints.safetyLimits?.avoidMeridianFlipWindow),
    );
    setSessionNotes(draft.notes ?? '');
    const mappedEdits: Record<string, ManualScheduleItem> = {};
    draft.manualEdits.forEach((edit) => {
      mappedEdits[edit.targetId] = edit;
    });
    setManualEdits(mappedEdits);
    setExcludedIds(new Set(draft.excludedTargetIds));
    if (draft.weatherSnapshot?.source === 'manual') {
      setWeatherInput({
        cloudCover: draft.weatherSnapshot.cloudCover,
        humidity: draft.weatherSnapshot.humidity,
        windSpeed: draft.weatherSnapshot.windSpeed,
        dewPoint: draft.weatherSnapshot.dewPoint,
      });
    }
    setPlanningMode(draft.manualEdits.length > 0 ? 'manual' : 'auto');
  }, []);

  const refreshWeatherAndSafety = useCallback(async () => {
    if (!isTauri() || !mountConnected) {
      setDeviceWeather(null);
      setSafetyState(null);
      return;
    }
    setWeatherLoading(true);
    try {
      const [conditions, safety] = await Promise.all([
        mountApi.getObservingConditions().catch(() => null),
        mountApi.getSafetyState().catch(() => null),
      ]);
      setDeviceWeather(conditions);
      setSafetyState(safety);
    } finally {
      setWeatherLoading(false);
    }
  }, [mountConnected]);

  const loadTauriTemplates = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const result = await tauriApi.sessionIo.loadSessionTemplates();
      const converted: SavedSessionTemplate[] = [];
      for (const entry of result) {
        if (!isSessionDraftV2(entry.draft)) continue;
        converted.push({
          id: entry.id,
          name: entry.name,
          draft: entry.draft,
          createdAt: entry.created_at,
          updatedAt: entry.updated_at,
        });
      }
      setRemoteTemplates(converted);
    } catch {
      setRemoteTemplates([]);
    }
  }, []);

  const parseImportedDraft = useCallback((rawContent: string): SessionDraftV2 | null => {
    const content = rawContent.trim();
    if (!content) return null;

    const parseCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          const next = line[i + 1];
          if (inQuotes && next === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
          continue;
        }
        if (ch === ',' && !inQuotes) {
          result.push(current);
          current = '';
          continue;
        }
        current += ch;
      }
      result.push(current);
      return result.map((v) => v.trim());
    };

    const parseSkyMapCsv = (): SessionDraftV2 | null => {
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) return null;
      const header = parseCsvLine(lines[0]);
      const idxName = header.indexOf('name');
      const idxStart = header.indexOf('start_time');
      const idxEnd = header.indexOf('end_time');
      if (idxName < 0 || idxStart < 0 || idxEnd < 0) return null;

      const targetByName = new Map(activeTargets.map((tgt) => [tgt.name.trim().toLowerCase(), tgt.id]));
      const edits: ManualScheduleItem[] = [];
      let importedPlanDate: Date | null = null;

      for (const row of lines.slice(1)) {
        const cols = parseCsvLine(row);
        const name = cols[idxName]?.trim();
        const startIso = cols[idxStart]?.trim();
        const endIso = cols[idxEnd]?.trim();
        if (!name || !startIso || !endIso) continue;
        const targetId = targetByName.get(name.toLowerCase());
        if (!targetId) continue;

        const start = new Date(startIso);
        const end = new Date(endIso);
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) continue;
        if (!importedPlanDate) importedPlanDate = start;
        const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

        edits.push({
          targetId,
          startTime: start.toTimeString().slice(0, 5),
          endTime: end.toTimeString().slice(0, 5),
          durationMinutes,
          locked: true,
        });
      }

      if (edits.length === 0) return null;

      return {
        planDate: (importedPlanDate ?? planDate).toISOString(),
        strategy: 'balanced',
        constraints,
        excludedTargetIds: [],
        manualEdits: edits,
        notes: '',
      };
    };

    const parseNinaXml = (): SessionDraftV2 | null => {
      if (!content.startsWith('<')) return null;
      if (typeof DOMParser === 'undefined') return null;

      const doc = new DOMParser().parseFromString(content, 'text/xml');
      const parseError = doc.getElementsByTagName('parsererror')[0];
      if (parseError) return null;

      const lists = Array.from(doc.getElementsByTagName('CaptureSequenceList'));
      if (lists.length === 0) return null;

      const existingByName = new Set(activeTargets.map((tgt) => tgt.name.trim().toLowerCase()));
      const batch: Array<{ name: string; ra: number; dec: number; raString: string; decString: string }> = [];

      for (const node of lists) {
        const targetName = node.getAttribute('TargetName')?.trim();
        if (!targetName) continue;
        const normalized = targetName.toLowerCase();
        if (existingByName.has(normalized)) continue;

        const coords = node.getElementsByTagName('Coordinates')[0];
        const raText = coords?.getElementsByTagName('RA')[0]?.textContent?.trim() ?? '';
        const decText = coords?.getElementsByTagName('Dec')[0]?.textContent?.trim() ?? '';
        const raHours = Number(raText);
        const decDeg = Number(decText);
        if (!Number.isFinite(raHours) || !Number.isFinite(decDeg)) continue;

        const raDeg = raHours * 15;
        batch.push({
          name: targetName,
          ra: raDeg,
          dec: decDeg,
          raString: degreesToHMS(raDeg),
          decString: degreesToDMS(decDeg),
        });
        existingByName.add(normalized);
      }

      if (batch.length > 0) {
        addTargetsBatch(batch);
      }

      return {
        planDate: planDate.toISOString(),
        strategy: 'balanced',
        constraints,
        excludedTargetIds: [],
        manualEdits: [],
        notes: '',
      };
    };

    // Try structured imports first
    const ninaDraft = parseNinaXml();
    if (ninaDraft) return ninaDraft;
    const csvDraft = parseSkyMapCsv();
    if (csvDraft) return csvDraft;

    // JSON import (SkyMap drafts/exports)
    try {
      const parsed = JSON.parse(rawContent) as unknown;
      if (!parsed || typeof parsed !== 'object') return null;
      const maybeDraft = parsed as Partial<SessionDraftV2> & {
        draft?: SessionDraftV2;
        targets?: Array<{ name: string; startTime?: string; endTime?: string }>;
      };
      if (maybeDraft.draft) return maybeDraft.draft;
      if (maybeDraft.constraints && maybeDraft.planDate && maybeDraft.strategy && Array.isArray(maybeDraft.manualEdits)) {
        return {
          planDate: maybeDraft.planDate,
          strategy: maybeDraft.strategy,
          constraints: maybeDraft.constraints,
          excludedTargetIds: Array.isArray(maybeDraft.excludedTargetIds) ? maybeDraft.excludedTargetIds : [],
          manualEdits: maybeDraft.manualEdits,
          notes: maybeDraft.notes,
          weatherSnapshot: maybeDraft.weatherSnapshot,
          exportMeta: maybeDraft.exportMeta,
        };
      }
      if (maybeDraft.planDate && Array.isArray(maybeDraft.targets)) {
        const targetByName = new Map(
          activeTargets.map((target) => [target.name.trim().toLowerCase(), target.id]),
        );
        const edits = maybeDraft.targets
          .map((target) => {
            const targetId = targetByName.get(target.name.trim().toLowerCase());
            if (!targetId || !target.startTime || !target.endTime) return null;
            const start = new Date(target.startTime);
            const end = new Date(target.endTime);
            const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
            return {
              targetId,
              startTime: start.toTimeString().slice(0, 5),
              endTime: end.toTimeString().slice(0, 5),
              durationMinutes,
              locked: true,
            };
          })
          .filter((edit): edit is NonNullable<typeof edit> => Boolean(edit));

        return {
          planDate: maybeDraft.planDate,
          strategy: 'balanced',
          constraints,
          excludedTargetIds: [],
          manualEdits: edits,
          notes: '',
        };
      }
      return null;
    } catch {
      return null;
    }
  }, [activeTargets, addTargetsBatch, constraints, planDate]);

  useEffect(() => {
    if (!open) return;
    void refreshWeatherAndSafety();
    void loadTauriTemplates();
  }, [loadTauriTemplates, open, refreshWeatherAndSafety]);
  
  const manualOverrides = useMemo(
    () => Object.values(manualEdits).filter((edit) => planningMode === 'manual' || Boolean(edit.locked)),
    [manualEdits, planningMode],
  );

  // Generate optimized plan
  const plan = useMemo(
    () => optimizeScheduleV2(
      activeTargets,
      latitude,
      longitude,
      twilight,
      strategy,
      constraints,
      planDate,
      excludedIds,
      manualOverrides,
      weatherSnapshot,
      { mountSafetyConfig },
    ),
    [activeTargets, latitude, longitude, twilight, strategy, constraints, planDate, excludedIds, manualOverrides, weatherSnapshot, mountSafetyConfig]
  );

  useEffect(() => {
    setManualOrder((previous) => {
      const targetIds = plan.targets.map((target) => target.target.id);
      const kept = previous.filter((id) => targetIds.includes(id));
      const added = targetIds.filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [plan.targets]);

  const orderedTargets = useMemo(() => {
    if (manualOrder.length === 0) return plan.targets;
    const mapping = new Map(plan.targets.map((target) => [target.target.id, target]));
    return manualOrder
      .map((id) => mapping.get(id))
      .filter((target): target is SessionPlanV2['targets'][number] => Boolean(target))
      .map((target, index) => ({ ...target, order: index + 1 }));
  }, [plan.targets, manualOrder]);

  const displayedPlan = useMemo<SessionPlanV2>(
    () => ({
      ...plan,
      targets: orderedTargets,
    }),
    [plan, orderedTargets],
  );

  const currentTargetSignature = useMemo(
    () => displayedPlan.targets.map((target) => target.target.id).join('|'),
    [displayedPlan.targets],
  );

  const relatedSavedPlan = useMemo(
    () => savedPlans.find((saved) => (
      new Date(saved.planDate).toDateString() === planDate.toDateString()
      && saved.targets.map((target) => target.targetId).join('|') === currentTargetSignature
    )) ?? null,
    [currentTargetSignature, planDate, savedPlans],
  );

  const relatedExecution = useMemo(
    () => {
      if (!relatedSavedPlan) return null;
      return executions.find((execution) => (
        execution.sourcePlanId === relatedSavedPlan.id
        && execution.status !== 'archived'
      )) ?? null;
    },
    [executions, relatedSavedPlan],
  );
  
  // Get excluded targets for display
  const excludedTargets = useMemo(
    () => activeTargets.filter(t => excludedIds.has(t.id)),
    [activeTargets, excludedIds]
  );
  
  const toggleExclude = useCallback((targetId: string) => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(targetId)) {
        next.delete(targetId);
      } else {
        next.add(targetId);
      }
      return next;
    });
  }, []);
  
  const restoreAllExcluded = useCallback(() => {
    setExcludedIds(new Set());
  }, []);

  const updateManualEdit = useCallback((targetId: string, updates: Partial<Omit<ManualScheduleItem, 'targetId'>>) => {
    setManualEdits((previous) => ({
      ...previous,
      [targetId]: {
        ...previous[targetId],
        ...updates,
        targetId,
      },
    }));
  }, []);
  
  const handleTargetClick = useCallback((target: TargetItem) => {
    setActiveTarget(target.id);
    if (setViewDirection) {
      setViewDirection(target.ra, target.dec);
    }
  }, [setActiveTarget, setViewDirection]);
  
  const handleSavePlan = useCallback(() => {
    if (displayedPlan.targets.length === 0) return null;
    const dateStr = planDate.toLocaleDateString();
    const savedPlanId = savePlan({
      name: `${t('sessionPlanner.title')} - ${dateStr}`,
      planDate: planDate.toISOString(),
      latitude,
      longitude,
      strategy,
      minAltitude,
      minImagingTime,
      constraints,
      planningMode,
      targets: displayedPlan.targets.map(s => ({
        targetId: s.target.id,
        targetName: s.target.name,
        ra: s.target.ra,
        dec: s.target.dec,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
        duration: s.duration,
        maxAltitude: s.maxAltitude,
        moonDistance: s.moonDistance,
        feasibilityScore: s.feasibility.score,
        order: s.order,
      })),
      excludedTargetIds: Array.from(excludedIds),
      totalImagingTime: displayedPlan.totalImagingTime,
      nightCoverage: displayedPlan.nightCoverage,
      efficiency: displayedPlan.efficiency,
      notes: sessionNotes,
      weatherSnapshot,
      manualEdits: Object.values(manualEdits),
    });
    toast.success(t('sessionPlanner.planSaved'));
    return savedPlanId;
  }, [constraints, displayedPlan, excludedIds, latitude, longitude, manualEdits, minAltitude, minImagingTime, planDate, planningMode, savePlan, sessionNotes, strategy, t, weatherSnapshot]);

  const handleStartExecution = useCallback(async () => {
    if (displayedPlan.targets.length === 0) return;

    const savedPlanId = handleSavePlan();
    if (!savedPlanId) return;

    const dateStr = planDate.toLocaleDateString();
    const planName = `${t('sessionPlanner.title')} - ${dateStr}`;
    const executionTargets = displayedPlan.targets.map((target) => ({
      id: `${savedPlanId}-${target.target.id}`,
      targetId: target.target.id,
      targetName: target.target.name,
      scheduledStart: target.startTime.toISOString(),
      scheduledEnd: target.endTime.toISOString(),
      scheduledDurationMinutes: Math.max(1, Math.round(target.duration * 60)),
      order: target.order,
      status: 'planned' as const,
      observationIds: [],
    }));

    try {
      if (isTauri()) {
        const session = await tauriApi.observationLog.createPlannedSession({
          planDate: planDate.toISOString().slice(0, 10),
          sourcePlanId: savedPlanId,
          sourcePlanName: planName,
          notes: sessionNotes || undefined,
          weatherSnapshot,
          executionTargets,
        });
        syncExecutionFromObservationSession(session);
      } else {
        createExecutionFromPlan({
          id: savedPlanId,
          name: planName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          planDate: planDate.toISOString(),
          latitude,
          longitude,
          strategy,
          minAltitude,
          minImagingTime,
          constraints,
          planningMode,
          targets: displayedPlan.targets.map((target) => ({
            targetId: target.target.id,
            targetName: target.target.name,
            ra: target.target.ra,
            dec: target.target.dec,
            startTime: target.startTime.toISOString(),
            endTime: target.endTime.toISOString(),
            duration: target.duration,
            maxAltitude: target.maxAltitude,
            moonDistance: target.moonDistance,
            feasibilityScore: target.feasibility.score,
            order: target.order,
          })),
          excludedTargetIds: Array.from(excludedIds),
          totalImagingTime: displayedPlan.totalImagingTime,
          nightCoverage: displayedPlan.nightCoverage,
          efficiency: displayedPlan.efficiency,
          notes: sessionNotes || undefined,
          weatherSnapshot,
          manualEdits: Object.values(manualEdits),
        }, {
          status: 'active',
        });
      }

      toast.success(t('sessionPlanner.executionStarted'));
    } catch {
      toast.error(t('sessionPlanner.executionStartFailed'));
    }
  }, [
    constraints,
    createExecutionFromPlan,
    displayedPlan,
    excludedIds,
    handleSavePlan,
    latitude,
    longitude,
    manualEdits,
    minAltitude,
    minImagingTime,
    planDate,
    planningMode,
    sessionNotes,
    strategy,
    syncExecutionFromObservationSession,
    t,
    weatherSnapshot,
  ]);

  const handleContinueExecution = useCallback(() => {
    if (!relatedExecution) return;
    setActiveExecution(relatedExecution.id);
    toast.success(t('sessionPlanner.executionResumed'));
  }, [relatedExecution, setActiveExecution, t]);

  const handleSaveTemplate = useCallback(() => {
    const draft: SessionDraftV2 = {
      planDate: planDate.toISOString(),
      strategy,
      constraints,
      excludedTargetIds: Array.from(excludedIds),
      manualEdits: Object.values(manualEdits),
      notes: sessionNotes,
      weatherSnapshot,
    };
    const templateName = `${t('sessionPlanner.templatePrefix')} ${new Date().toLocaleTimeString()}`;
    saveTemplate({
      name: templateName,
      draft,
    });
    if (isTauri()) {
      void tauriApi.sessionIo
        .saveSessionTemplate(templateName, draft)
        .then((entry) => {
          setRemoteTemplates((previous) => {
            const next = previous.filter((item) => item.id !== entry.id);
            next.unshift({
              id: entry.id,
              name: entry.name,
              draft: entry.draft as unknown as SessionDraftV2,
              createdAt: entry.created_at,
              updatedAt: entry.updated_at,
            });
            return next;
          });
        })
        .catch(() => {
          toast.error(t('sessionPlanner.templateSaveFailed'));
        });
    }
    toast.success(t('sessionPlanner.templateSaved'));
  }, [constraints, excludedIds, manualEdits, planDate, saveTemplate, sessionNotes, strategy, t, weatherSnapshot]);

  const handleLoadTemplate = useCallback((templateId: string) => {
    const template = availableTemplates.find((item) => item.id === templateId) ?? loadTemplate(templateId);
    if (!template) return;
    applyDraft(template.draft);
    setShowTemplates(false);
    toast.success(t('sessionPlanner.templateLoaded'));
  }, [applyDraft, availableTemplates, loadTemplate, t]);
  
  const handleLoadPlan = useCallback((saved: SavedSessionPlan) => {
    const savedConstraints = saved.constraints ?? {
      minAltitude: saved.minAltitude,
      minImagingTime: saved.minImagingTime,
      minMoonDistance: 20,
      useExposurePlanDuration: true,
      weatherLimits: {
        maxCloudCover: 70,
        maxHumidity: 90,
        maxWindSpeed: 25,
      },
      safetyLimits: {
        enforceMountSafety: false,
        avoidMeridianFlipWindow: false,
      },
    };

    setPlanDate(new Date(saved.planDate));
    setStrategy(saved.strategy);
    setMinAltitude(savedConstraints.minAltitude);
    setMinImagingTime(savedConstraints.minImagingTime);
    setMinMoonDistance(savedConstraints.minMoonDistance ?? 20);
    setUseExposurePlanDuration(savedConstraints.useExposurePlanDuration ?? true);
    setSessionWindowStartTime(savedConstraints.sessionWindow?.startTime ?? '');
    setSessionWindowEndTime(savedConstraints.sessionWindow?.endTime ?? '');
    const nextEnforceMountSafety = Boolean(savedConstraints.safetyLimits?.enforceMountSafety);
    setEnforceMountSafety(nextEnforceMountSafety);
    setAvoidMeridianFlipWindow(
      nextEnforceMountSafety && Boolean(savedConstraints.safetyLimits?.avoidMeridianFlipWindow),
    );
    setSessionNotes(saved.notes ?? '');
    if (saved.weatherSnapshot) {
      setWeatherInput({
        cloudCover: saved.weatherSnapshot.cloudCover,
        humidity: saved.weatherSnapshot.humidity,
        windSpeed: saved.weatherSnapshot.windSpeed,
        dewPoint: saved.weatherSnapshot.dewPoint,
      });
    } else {
      setWeatherInput({});
    }
    const nextEdits: Record<string, ManualScheduleItem> = {};
    saved.manualEdits?.forEach((edit) => {
      nextEdits[edit.targetId] = edit;
    });
    setManualEdits(nextEdits);
    setPlanningMode(saved.planningMode ?? (saved.manualEdits && saved.manualEdits.length > 0 ? 'manual' : 'auto'));
    // Filter out stale exclusion IDs that no longer match current targets
    const currentTargetIds = new Set(activeTargets.map(t => t.id));
    const validExcluded = saved.excludedTargetIds.filter(id => currentTargetIds.has(id));
    setExcludedIds(new Set(validExcluded));
    setShowSavedPlans(false);
  }, [activeTargets]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setManualOrder((previous) => {
      const oldIndex = previous.indexOf(String(active.id));
      const newIndex = previous.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return previous;
      return arrayMove(previous, oldIndex, newIndex);
    });
    setPlanningMode('manual');
  }, []);

  const handleQuickOpenRecommendations = useCallback(() => {
    setOpen(false);
    openTonightRecommendations();
  }, [openTonightRecommendations, setOpen]);

  const handleQuickOpenShotList = useCallback(() => {
    setOpen(false);
    openShotList();
  }, [openShotList, setOpen]);

  const toInputTime = useCallback((value: Date) => value.toTimeString().slice(0, 5), []);

  const handleStartTimeChange = useCallback((targetId: string, startTime: string) => {
    updateManualEdit(targetId, { startTime, locked: true });
    setPlanningMode('manual');
  }, [updateManualEdit]);

  const handleDurationChange = useCallback((targetId: string, durationMinutes: number) => {
    updateManualEdit(targetId, { durationMinutes, locked: true });
    setPlanningMode('manual');
  }, [updateManualEdit]);

  const handleToggleLock = useCallback((targetId: string, locked: boolean) => {
    updateManualEdit(targetId, { locked });
    setPlanningMode('manual');
  }, [updateManualEdit]);

  const handleExportPlan = useCallback(async (format: 'text' | 'markdown' | 'json' | 'nina-xml' | 'csv' | 'sgp-csv') => {
    const exported = exportSessionPlan(displayedPlan, {
      format,
      planDate,
      latitude,
      longitude,
    });

    if (isTauri()) {
      try {
        await tauriApi.sessionIo.exportSessionPlan(exported, format);
        toast.success(t('sessionPlanner.exportSaved'));
        return;
      } catch {
        // fallback to clipboard below
      }
    }

    await navigator.clipboard.writeText(exported);
    toast.success(t('sessionPlanner.planCopied'));
  }, [displayedPlan, planDate, latitude, longitude, t]);

  const handleImportPlan = useCallback(async () => {
    if (!isTauri()) {
      toast.error(t('sessionPlanner.importDesktopOnly'));
      return;
    }
    try {
      const content = await tauriApi.sessionIo.importSessionPlan();
      const draft = parseImportedDraft(content);
      if (!draft) {
        toast.error(t('sessionPlanner.importFailed'));
        return;
      }
      importPlanV2(draft);
      applyDraft(draft);
      toast.success(t('sessionPlanner.importSuccess'));
    } catch {
      toast.error(t('sessionPlanner.importFailed'));
    }
  }, [applyDraft, importPlanV2, parseImportedDraft, t]);

  const weatherSourceLabel = weatherSnapshot
    ? weatherSnapshot.source === 'device'
      ? t('sessionPlanner.weatherSourceDevice')
      : t('sessionPlanner.weatherSourceManual')
    : t('sessionPlanner.weatherSourceNone');
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <CalendarClock className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('sessionPlanner.title')}</p>
        </TooltipContent>
      </Tooltip>
      
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            {t('sessionPlanner.title')}
          </DialogTitle>
          <DialogDescription>{t('sessionPlanner.dialogDescription')}</DialogDescription>
        </DialogHeader>

        {relatedExecution && (
          <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              <span>{t('sessionPlanner.executionStatusLabel')}</span>
            </div>
            <Badge variant={activeExecutionId === relatedExecution.id ? 'default' : 'secondary'}>
              {t(`sessionPlanner.executionStatus.${relatedExecution.status}`)}
            </Badge>
          </div>
        )}
        
        {/* Night & Equipment Overview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-4 text-sm">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs font-normal">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {planDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={planDate}
                    onSelect={(d) => d && setPlanDate(d)}
                    defaultMonth={planDate}
                  />
                </PopoverContent>
              </Popover>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-1.5">
                <Sun className="h-4 w-4 text-amber-500" />
                <span className="font-medium">{formatDuration(twilight.darknessDuration)}</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-1.5">
                <Moon className="h-4 w-4 text-amber-400" />
                <span className="text-muted-foreground">{getMoonPhaseName(moonPhase)}</span>
                <span>({moonIllum}%)</span>
              </div>
            </div>
            <Badge variant={twilight.isCurrentlyNight ? 'default' : 'secondary'}>
              {twilight.isCurrentlyNight ? t('sessionPlanner.night') : t('sessionPlanner.daylight')}
            </Badge>
          </div>
          
          {/* Equipment Info */}
          {focalLength > 0 && (
            <div className="flex items-center gap-4 px-3 py-2 text-xs text-muted-foreground">
              <span>{t('sessionPlanner.equipment')}:</span>
              <span>{focalLength}mm f/{aperture > 0 ? (focalLength / aperture).toFixed(1) : '?'}</span>
              <Separator orientation="vertical" className="h-3" />
              <span>{t('sessionPlanner.fovInfo', { w: fovWidth.toFixed(1), h: fovHeight.toFixed(1) })}</span>
            </div>
          )}
        </div>
        
        {/* Settings */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between" size="sm">
              <span className="flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
                {t('sessionPlanner.optimizationSettings')}
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">{t('sessionPlanner.mode')}</Label>
                <Select value={planningMode} onValueChange={(value) => setPlanningMode(value as 'auto' | 'manual')}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{t('sessionPlanner.modeAuto')}</SelectItem>
                    <SelectItem value="manual">{t('sessionPlanner.modeManual')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">{t('sessionPlanner.strategy')}</Label>
                <Select value={strategy} onValueChange={(v) => setStrategy(v as OptimizationStrategy)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced">{t('sessionPlanner.strategyBalanced')}</SelectItem>
                    <SelectItem value="altitude">{t('sessionPlanner.strategyAltitude')}</SelectItem>
                    <SelectItem value="transit">{t('sessionPlanner.strategyTransit')}</SelectItem>
                    <SelectItem value="moon">{t('sessionPlanner.strategyMoon')}</SelectItem>
                    <SelectItem value="duration">{t('sessionPlanner.strategyDuration')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
               
              <div className="space-y-2">
                <Label className="text-xs">{t('sessionPlanner.minAltitude')}: {minAltitude}°</Label>
                <Slider
                  value={[minAltitude]}
                  onValueChange={([v]) => setMinAltitude(v)}
                  min={10}
                  max={60}
                  step={5}
                />
              </div>
               
              <div className="space-y-2">
                <Label className="text-xs">{t('sessionPlanner.minImagingTime')}: {minImagingTime}m</Label>
                <Slider
                  value={[minImagingTime]}
                  onValueChange={([v]) => setMinImagingTime(v)}
                  min={15}
                  max={120}
                  step={15}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">{t('sessionPlanner.minMoonDistance')}: {minMoonDistance}°</Label>
                <Slider
                  value={[minMoonDistance]}
                  onValueChange={([v]) => setMinMoonDistance(v)}
                  min={0}
                  max={90}
                  step={5}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={useExposurePlanDuration}
                  onCheckedChange={setUseExposurePlanDuration}
                  id="useExposurePlanDuration"
                />
                <Label htmlFor="useExposurePlanDuration" className="text-xs">
                  {t('sessionPlanner.useExposurePlanDuration')}
                </Label>
              </div>

              <div className="col-span-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">{t('sessionPlanner.sessionWindow')}</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[10px]"
                      disabled={!twilight.astronomicalDusk || !twilight.astronomicalDawn}
                      onClick={() => {
                        if (!twilight.astronomicalDusk || !twilight.astronomicalDawn) return;
                        setSessionWindowStartTime(twilight.astronomicalDusk.toTimeString().slice(0, 5));
                        setSessionWindowEndTime(twilight.astronomicalDawn.toTimeString().slice(0, 5));
                      }}
                    >
                      <Sun className="mr-1 h-3 w-3" />
                      {t('sessionPlanner.fillDuskDawn')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[10px]"
                      disabled={!sessionWindowStartTime && !sessionWindowEndTime}
                      onClick={() => {
                        setSessionWindowStartTime('');
                        setSessionWindowEndTime('');
                      }}
                    >
                      {t('common.clear')}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="sessionWindowStart" className="text-[10px] text-muted-foreground">
                      {t('sessionPlanner.sessionWindowStart')}
                    </Label>
                    <Input
                      id="sessionWindowStart"
                      type="time"
                      value={sessionWindowStartTime}
                      onChange={(event) => setSessionWindowStartTime(event.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sessionWindowEnd" className="text-[10px] text-muted-foreground">
                      {t('sessionPlanner.sessionWindowEnd')}
                    </Label>
                    <Input
                      id="sessionWindowEnd"
                      type="time"
                      value={sessionWindowEndTime}
                      onChange={(event) => setSessionWindowEndTime(event.target.value)}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-2 space-y-2">
                <Label className="text-xs">{t('sessionPlanner.safetyLimits')}</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={enforceMountSafety}
                    onCheckedChange={(checked) => {
                      setEnforceMountSafety(checked);
                      if (!checked) setAvoidMeridianFlipWindow(false);
                    }}
                    id="enforceMountSafety"
                  />
                  <Label htmlFor="enforceMountSafety" className="text-xs">
                    {t('sessionPlanner.enforceMountSafety')}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={avoidMeridianFlipWindow}
                    onCheckedChange={setAvoidMeridianFlipWindow}
                    id="avoidMeridianFlipWindow"
                    disabled={!enforceMountSafety}
                  />
                  <Label
                    htmlFor="avoidMeridianFlipWindow"
                    className={cn('text-xs', !enforceMountSafety && 'text-muted-foreground')}
                  >
                    {t('sessionPlanner.avoidMeridianFlipWindow')}
                  </Label>
                </div>
              </div>
               
              <div className="flex items-center gap-2">
                <Switch checked={showGaps} onCheckedChange={setShowGaps} id="showGaps" />
                <Label htmlFor="showGaps" className="text-xs">{t('sessionPlanner.showGaps')}</Label>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span>{t('sessionPlanner.weatherSourceLabel')}: {weatherSourceLabel}</span>
            <div className="flex items-center gap-2">
              {safetyState && (
                <Badge variant={safetyState.isSafe ? 'secondary' : 'destructive'} data-testid="session-weather-safety">
                  {safetyState.isSafe ? t('sessionPlanner.safetySafe') : t('sessionPlanner.safetyUnsafe')}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px]"
                onClick={() => void refreshWeatherAndSafety()}
                disabled={!isTauri() || weatherLoading || !mountConnected}
              >
                {weatherLoading ? t('common.loading') : t('sessionPlanner.refreshWeather')}
              </Button>
            </div>
          </div>
          {safetyState && !safetyState.isSafe && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{t('sessionPlanner.safetyWarning')}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('sessionPlanner.weatherCloudCover')}</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={weatherInput.cloudCover ?? ''}
              onChange={(event) => setWeatherInput((previous) => ({
                ...previous,
                cloudCover: event.target.value === '' ? undefined : Number(event.target.value),
              }))}
              className="h-8"
              data-testid="session-weather-cloud-cover"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('sessionPlanner.weatherHumidity')}</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={weatherInput.humidity ?? ''}
              onChange={(event) => setWeatherInput((previous) => ({
                ...previous,
                humidity: event.target.value === '' ? undefined : Number(event.target.value),
              }))}
              className="h-8"
              data-testid="session-weather-humidity"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('sessionPlanner.weatherWindSpeed')}</Label>
            <Input
              type="number"
              min={0}
              value={weatherInput.windSpeed ?? ''}
              onChange={(event) => setWeatherInput((previous) => ({
                ...previous,
                windSpeed: event.target.value === '' ? undefined : Number(event.target.value),
              }))}
              className="h-8"
              data-testid="session-weather-wind"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('sessionPlanner.weatherDewPoint')}</Label>
            <Input
              type="number"
              value={weatherInput.dewPoint ?? ''}
              onChange={(event) => setWeatherInput((previous) => ({
                ...previous,
                dewPoint: event.target.value === '' ? undefined : Number(event.target.value),
              }))}
              className="h-8"
              data-testid="session-weather-dew-point"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="session-notes">{t('sessionPlanner.notes')}</Label>
          <Textarea
            id="session-notes"
            value={sessionNotes}
            onChange={(event) => setSessionNotes(event.target.value)}
            className="min-h-16 text-xs"
            placeholder={t('sessionPlanner.notesPlaceholder')}
            data-testid="session-notes"
          />
        </div>

        <Separator />
        
        {/* Plan Summary */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard value={displayedPlan.targets.length} label={t('sessionPlanner.targets')} />
          <StatCard value={formatDuration(displayedPlan.totalImagingTime)} label={t('sessionPlanner.imagingTime')} />
          <StatCard
            value={`${displayedPlan.nightCoverage.toFixed(0)}%`}
            label={t('sessionPlanner.nightCoverage')}
            valueClassName={cn(
              displayedPlan.nightCoverage >= 80 ? 'text-green-500' : 
              displayedPlan.nightCoverage >= 50 ? 'text-amber-500' : 'text-red-500'
            )}
          />
          <StatCard
            value={`${displayedPlan.efficiency.toFixed(0)}%`}
            label={t('sessionPlanner.efficiency')}
            valueClassName={cn(
              displayedPlan.efficiency >= 70 ? 'text-green-500' : 
              displayedPlan.efficiency >= 50 ? 'text-amber-500' : 'text-red-500'
            )}
          />
        </div>
        
        {/* Timeline */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Timer className="h-4 w-4" />
            {t('sessionPlanner.timeline')}
          </div>
          <SessionTimeline
            plan={displayedPlan}
            twilight={twilight}
            onTargetClick={handleTargetClick}
            showGaps={showGaps}
          />
        </div>
        
        {/* Recommendations & Warnings */}
        {(displayedPlan.recommendations.length > 0 || displayedPlan.warnings.length > 0 || displayedPlan.conflicts.length > 0) && (
          <div className="space-y-2">
            {displayedPlan.warnings.map((warning, i) => (
              <div key={`warn-${i}`} className="flex items-start gap-2 text-sm text-amber-500 p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{t(warning.key, warning.params)}</span>
              </div>
            ))}
            {displayedPlan.recommendations.map((rec, i) => (
              <div key={`rec-${i}`} className="flex items-start gap-2 text-sm text-muted-foreground p-2 rounded-lg bg-muted/50">
                <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>{t(rec.key, rec.params)}</span>
              </div>
            ))}
            {displayedPlan.conflicts.map((conflict, index) => (
              <div key={`conflict-${index}`} className="flex items-start gap-2 text-sm text-destructive p-2 rounded-lg bg-destructive/10" data-testid={`session-conflict-${conflict.type}`}>
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{conflict.message}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Scheduled Targets List */}
        <div className="space-y-2 flex-1 min-h-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ListOrdered className="h-4 w-4" />
              {t('sessionPlanner.schedule')}
            </div>
            <Badge variant="outline" className="text-xs">
              {displayedPlan.targets.length} / {activeTargets.length} {t('sessionPlanner.scheduled')}
            </Badge>
          </div>
          
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2 pr-4">
              {displayedPlan.targets.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 space-y-3">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{t('sessionPlanner.noTargets')}</p>
                  <p className="text-xs">{t('sessionPlanner.addTargetsHint')}</p>
                  <div className="flex flex-col items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={handleQuickOpenRecommendations}
                    >
                      <Sparkles className="h-3 w-3 mr-1.5" />
                      {t('sessionPlanner.browseRecommendations')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={handleQuickOpenShotList}
                    >
                      <ListOrdered className="h-3 w-3 mr-1.5" />
                      {t('sessionPlanner.openShotList')}
                    </Button>
                  </div>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={displayedPlan.targets.map((target) => target.target.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {displayedPlan.targets.map((scheduled) => {
                        const edit = manualEdits[scheduled.target.id];
                        return (
                          <SortableTargetCard key={scheduled.target.id} scheduled={scheduled}>
                            <div className="space-y-2">
                              {planningMode === 'manual' && (
                                <div className="grid grid-cols-3 gap-2 p-2 rounded-md bg-muted/40">
                                  <div className="space-y-1">
                                    <Label className="text-[10px]">{t('sessionPlanner.startTime')}</Label>
                                    <Input
                                      type="time"
                                      value={edit?.startTime ?? toInputTime(scheduled.startTime)}
                                      onChange={(event) => handleStartTimeChange(scheduled.target.id, event.target.value)}
                                      className="h-7 text-xs"
                                      data-testid={`session-start-${scheduled.target.id}`}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px]">{t('sessionPlanner.durationMinutes')}</Label>
                                    <Input
                                      type="number"
                                      min={15}
                                      step={5}
                                      value={edit?.durationMinutes ?? Math.round(scheduled.duration * 60)}
                                      onChange={(event) => handleDurationChange(scheduled.target.id, Number(event.target.value))}
                                      className="h-7 text-xs"
                                      data-testid={`session-duration-${scheduled.target.id}`}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px]">{t('sessionPlanner.lockTarget')}</Label>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 w-full"
                                      onClick={() => handleToggleLock(scheduled.target.id, !edit?.locked)}
                                      data-testid={`session-lock-${scheduled.target.id}`}
                                    >
                                      {edit?.locked ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
                                      {edit?.locked ? t('sessionPlanner.locked') : t('sessionPlanner.unlocked')}
                                    </Button>
                                  </div>
                                </div>
                              )}
                              <ScheduledTargetCard
                                scheduled={scheduled}
                                onNavigate={() => handleTargetClick(scheduled.target)}
                                onExclude={() => toggleExclude(scheduled.target.id)}
                              />
                            </div>
                          </SortableTargetCard>
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
              
              {/* Excluded targets */}
              {excludedTargets.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <EyeOff className="h-3.5 w-3.5" />
                      {t('sessionPlanner.excludedTargets', { count: excludedTargets.length })}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={restoreAllExcluded}
                    >
                      {t('sessionPlanner.restoreAll')}
                    </Button>
                  </div>
                  {excludedTargets.map(target => (
                    <div
                      key={target.id}
                      className="flex items-center justify-between p-2 rounded-lg border border-dashed border-border opacity-50"
                    >
                      <span className="text-sm text-muted-foreground">{target.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => toggleExclude(target.id)}
                      >
                        {t('sessionPlanner.restore')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        
        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            <MountSafetySimulator
              planDate={planDate}
              strategy={strategy}
              minAltitude={minAltitude}
              minImagingTime={minImagingTime}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSavePlan}
                  disabled={displayedPlan.targets.length === 0}
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {t('sessionPlanner.savePlan')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('sessionPlanner.savePlanTooltip')}</TooltipContent>
            </Tooltip>
            {relatedExecution ? (
              <Button variant="secondary" size="sm" onClick={handleContinueExecution}>
                <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                {t('sessionPlanner.continueExecution')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleStartExecution()}
                disabled={displayedPlan.targets.length === 0}
              >
                <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                {t('sessionPlanner.startExecution')}
              </Button>
            )}
            {savedPlans.length > 0 && (
              <Popover open={showSavedPlans} onOpenChange={setShowSavedPlans}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                    {t('sessionPlanner.loadPlan')}
                    <Badge variant="secondary" className="ml-1.5 text-[10px]">{savedPlans.length}</Badge>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="start">
                  <ScrollArea className="max-h-48">
                    <div className="space-y-1">
                      {savedPlans.map(saved => (
                        <div
                          key={saved.id}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer group"
                        >
                          <button
                            className="flex-1 text-left"
                            onClick={() => handleLoadPlan(saved)}
                          >
                            <div className="text-sm font-medium truncate">{saved.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {new Date(saved.planDate).toLocaleDateString()} · {saved.targets.length} {t('sessionPlanner.targets').toLowerCase()}
                            </div>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteSavedPlan(saved.id); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}
            <Button variant="outline" size="sm" onClick={() => void handleImportPlan()}>
              {t('sessionPlanner.importPlan')}
            </Button>
            <Popover open={showTemplates} onOpenChange={setShowTemplates}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  {t('sessionPlanner.templates')}
                  <Badge variant="secondary" className="ml-1.5 text-[10px]">{availableTemplates.length}</Badge>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="start" data-testid="session-template-list">
                <div className="space-y-2">
                  <Button size="sm" variant="secondary" className="w-full" onClick={handleSaveTemplate}>
                    {t('sessionPlanner.saveTemplate')}
                  </Button>
                  <ScrollArea className="max-h-40">
                    <div className="space-y-1">
                      {availableTemplates.length === 0 && (
                        <div className="text-xs text-muted-foreground p-2">{t('sessionPlanner.noTemplates')}</div>
                      )}
                      {availableTemplates.map((template) => (
                        <Button
                          key={template.id}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-xs"
                          onClick={() => handleLoadTemplate(template.id)}
                        >
                          {template.name}
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" disabled={displayedPlan.targets.length === 0}>
                  {t('sessionPlanner.copyPlan')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1" align="start">
                {(['text', 'markdown', 'json', 'nina-xml', 'csv', 'sgp-csv'] as const).map(fmt => (
                  <Button
                    key={fmt}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-7"
                    onClick={() => void handleExportPlan(fmt)}
                  >
                    {t(`sessionPlanner.exportFormat.${fmt}`)}
                  </Button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
