import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getZustandStorage } from '@/lib/storage';
import { createLogger } from '@/lib/logger';
import type { OptimizationStrategy } from '@/types/starmap/planning';
import type {
  ExecutionSummary,
  ExecutionTargetStatus,
  PlannedSessionExecution,
  PlannedSessionExecutionTarget,
  SessionDraftV2,
  SessionExecutionStatus,
  SessionTemplate,
  SessionWeatherSnapshot,
} from '@/types/starmap/session-planner-v2';
export type {
  PlannedSessionExecution,
  PlannedSessionExecutionTarget,
} from '@/types/starmap/session-planner-v2';

const logger = createLogger('session-plan-store');

// ============================================================================
// Types
// ============================================================================

export interface SavedScheduledTarget {
  targetId: string;
  targetName: string;
  ra: number;
  dec: number;
  startTime: string; // ISO string for serialization
  endTime: string;
  duration: number;
  maxAltitude: number;
  moonDistance: number;
  feasibilityScore: number;
  order: number;
}

export interface SavedSessionPlan {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  // Planning parameters
  planDate: string;
  latitude: number;
  longitude: number;
  strategy: OptimizationStrategy;
  minAltitude: number;
  minImagingTime: number;
  /** Full constraint snapshot (preferred for restoring UI). */
  constraints?: SessionDraftV2['constraints'];
  /** UI planning mode at time of saving. */
  planningMode?: 'auto' | 'manual';
  // Results snapshot
  targets: SavedScheduledTarget[];
  excludedTargetIds: string[];
  totalImagingTime: number;
  nightCoverage: number;
  efficiency: number;
  notes?: string;
  weatherSnapshot?: SessionWeatherSnapshot;
  manualEdits?: SessionDraftV2['manualEdits'];
}

export interface SavedSessionTemplate {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  draft: SessionDraftV2;
}

interface CreateExecutionContext {
  locationId?: string;
  locationName?: string;
  status?: SessionExecutionStatus;
}

interface ExecutionTargetSnapshot {
  id: string;
  target_id: string;
  target_name: string;
  scheduled_start: string;
  scheduled_end: string;
  scheduled_duration_minutes: number;
  order: number;
  status: ExecutionTargetStatus;
  observation_ids?: string[];
  actual_start?: string;
  actual_end?: string;
  result_notes?: string;
  skip_reason?: string;
  completion_summary?: string;
  unplanned?: boolean;
}

interface ExecutionSummarySnapshot {
  completed_targets: number;
  skipped_targets: number;
  failed_targets: number;
  total_targets: number;
  total_observations: number;
}

interface ExecutionSessionSnapshot {
  id: string;
  date: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  start_time?: string;
  end_time?: string;
  source_plan_id?: string;
  source_plan_name?: string;
  execution_status?: SessionExecutionStatus;
  weather_snapshot?: unknown;
  execution_summary?: ExecutionSummarySnapshot;
  execution_targets?: ExecutionTargetSnapshot[];
}

export interface SessionPlanState {
  savedPlans: SavedSessionPlan[];
  templates: SavedSessionTemplate[];
  activePlanId: string | null;
  executions: PlannedSessionExecution[];
  activeExecutionId: string | null;

  // Actions
  savePlan: (plan: Omit<SavedSessionPlan, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updatePlan: (id: string, updates: Partial<Omit<SavedSessionPlan, 'id' | 'createdAt'>>) => void;
  deletePlan: (id: string) => void;
  setActivePlan: (id: string | null) => void;
  getActivePlan: () => SavedSessionPlan | null;
  getPlanById: (id: string) => SavedSessionPlan | undefined;
  renamePlan: (id: string, name: string) => void;
  duplicatePlan: (id: string) => string | null;
  importPlanV2: (draft: SessionDraftV2, name?: string) => string;
  saveTemplate: (template: Omit<SessionTemplate, 'id' | 'createdAt' | 'updatedAt'>) => string;
  loadTemplate: (id: string) => SavedSessionTemplate | undefined;
  deleteTemplate: (id: string) => void;
  listTemplates: () => SavedSessionTemplate[];
  createExecutionFromPlan: (plan: SavedSessionPlan, context?: CreateExecutionContext) => string;
  setActiveExecution: (id: string | null) => void;
  getActiveExecution: () => PlannedSessionExecution | null;
  getExecutionById: (id: string) => PlannedSessionExecution | undefined;
  syncExecutionFromObservationSession: (session: ExecutionSessionSnapshot) => string | null;
  updateExecutionTarget: (
    executionId: string,
    targetId: string,
    updates: Partial<PlannedSessionExecutionTarget>,
  ) => void;
  attachObservationToExecutionTarget: (
    executionId: string,
    targetId: string,
    observationId: string,
  ) => void;
  completeExecution: (executionId: string, summary?: ExecutionSummary) => void;
  archiveExecution: (executionId: string) => void;
}

// ============================================================================
// Store
// ============================================================================

/** Maximum number of saved session plans to retain */
const MAX_SAVED_PLANS = 50;
const MAX_SAVED_TEMPLATES = 50;

function generatePlanId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateTemplateId(): string {
  return `template_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateExecutionId(): string {
  return `execution_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createExecutionTargets(plan: SavedSessionPlan): PlannedSessionExecutionTarget[] {
  return plan.targets.map((target) => ({
    id: `${plan.id}_${target.targetId}`,
    targetId: target.targetId,
    targetName: target.targetName,
    scheduledStart: target.startTime,
    scheduledEnd: target.endTime,
    scheduledDurationMinutes: Math.max(1, Math.round(target.duration * 60)),
    order: target.order,
    status: 'planned',
    observationIds: [],
  }));
}

function mapSnapshotTarget(target: ExecutionTargetSnapshot): PlannedSessionExecutionTarget {
  return {
    id: target.id,
    targetId: target.target_id,
    targetName: target.target_name,
    scheduledStart: target.scheduled_start,
    scheduledEnd: target.scheduled_end,
    scheduledDurationMinutes: target.scheduled_duration_minutes,
    order: target.order,
    status: target.status,
    observationIds: target.observation_ids ?? [],
    actualStart: target.actual_start,
    actualEnd: target.actual_end,
    resultNotes: target.result_notes,
    skipReason: target.skip_reason,
    completionSummary: target.completion_summary,
    unplanned: target.unplanned,
  };
}

function upsertExecution(
  executions: PlannedSessionExecution[],
  nextExecution: PlannedSessionExecution,
): PlannedSessionExecution[] {
  const filtered = executions.filter((execution) => execution.id !== nextExecution.id);
  return [nextExecution, ...filtered];
}

export const useSessionPlanStore = create<SessionPlanState>()(
  persist(
    (set, get) => ({
      savedPlans: [],
      templates: [],
      activePlanId: null,
      executions: [],
      activeExecutionId: null,

      savePlan: (plan) => {
        const id = generatePlanId();
        const now = new Date().toISOString();
        const newPlan: SavedSessionPlan = {
          ...plan,
          id,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          savedPlans: [newPlan, ...state.savedPlans].slice(0, MAX_SAVED_PLANS),
          activePlanId: id,
        }));
        logger.info('Session plan saved', { id, name: plan.name });
        return id;
      },

      updatePlan: (id, updates) => {
        set((state) => ({
          savedPlans: state.savedPlans.map((p) =>
            p.id === id
              ? { ...p, ...updates, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      deletePlan: (id) => {
        set((state) => ({
          savedPlans: state.savedPlans.filter((p) => p.id !== id),
          activePlanId: state.activePlanId === id ? null : state.activePlanId,
        }));
        logger.info('Session plan deleted', { id });
      },

      setActivePlan: (id) => {
        set({ activePlanId: id });
      },

      getActivePlan: () => {
        const state = get();
        if (!state.activePlanId) return null;
        return state.savedPlans.find((p) => p.id === state.activePlanId) ?? null;
      },

      getPlanById: (id) => {
        return get().savedPlans.find((p) => p.id === id);
      },

      renamePlan: (id, name) => {
        set((state) => ({
          savedPlans: state.savedPlans.map((p) =>
            p.id === id
              ? { ...p, name, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      duplicatePlan: (id) => {
        const source = get().savedPlans.find((p) => p.id === id);
        if (!source) return null;
        const newId = generatePlanId();
        const now = new Date().toISOString();
        const copy: SavedSessionPlan = {
          ...source,
          id: newId,
          name: `${source.name} (copy)`,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          savedPlans: [copy, ...state.savedPlans].slice(0, MAX_SAVED_PLANS),
          activePlanId: newId,
        }));
        return newId;
      },

      importPlanV2: (draft, name) => {
        const fallbackName = name ?? `Session ${new Date(draft.planDate).toLocaleDateString()}`;
        return get().savePlan({
          name: fallbackName,
          planDate: draft.planDate,
          latitude: 0,
          longitude: 0,
          strategy: draft.strategy,
          minAltitude: draft.constraints.minAltitude,
          minImagingTime: draft.constraints.minImagingTime,
          constraints: draft.constraints,
          planningMode: draft.manualEdits.length > 0 ? 'manual' : 'auto',
          targets: [],
          excludedTargetIds: draft.excludedTargetIds,
          totalImagingTime: 0,
          nightCoverage: 0,
          efficiency: 0,
          notes: draft.notes,
          weatherSnapshot: draft.weatherSnapshot,
          manualEdits: draft.manualEdits,
        });
      },

      saveTemplate: (template) => {
        const id = generateTemplateId();
        const now = new Date().toISOString();
        const nextTemplate: SavedSessionTemplate = {
          id,
          name: template.name,
          draft: template.draft,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          templates: [nextTemplate, ...state.templates].slice(0, MAX_SAVED_TEMPLATES),
        }));
        logger.info('Session template saved', { id, name: template.name });
        return id;
      },

      loadTemplate: (id) => {
        return get().templates.find((template) => template.id === id);
      },

      deleteTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter((template) => template.id !== id),
        }));
      },

      listTemplates: () => get().templates,

      createExecutionFromPlan: (plan, context = {}) => {
        const now = new Date().toISOString();
        const execution: PlannedSessionExecution = {
          id: generateExecutionId(),
          sourcePlanId: plan.id,
          sourcePlanName: plan.name,
          status: context.status ?? 'ready',
          planDate: plan.planDate,
          locationId: context.locationId,
          locationName: context.locationName,
          notes: plan.notes,
          weatherSnapshot: plan.weatherSnapshot,
          createdAt: now,
          updatedAt: now,
          targets: createExecutionTargets(plan),
        };

        set((state) => ({
          executions: upsertExecution(state.executions, execution),
          activeExecutionId: execution.id,
        }));
        logger.info('Session execution created', {
          executionId: execution.id,
          sourcePlanId: plan.id,
        });
        return execution.id;
      },

      setActiveExecution: (id) => {
        set({ activeExecutionId: id });
      },

      getActiveExecution: () => {
        const state = get();
        if (!state.activeExecutionId) return null;
        return state.executions.find((execution) => execution.id === state.activeExecutionId) ?? null;
      },

      getExecutionById: (id) => {
        return get().executions.find((execution) => execution.id === id);
      },

      syncExecutionFromObservationSession: (session) => {
        if (!session.source_plan_id) return null;

        const execution: PlannedSessionExecution = {
          id: session.id,
          sourcePlanId: session.source_plan_id,
          sourcePlanName: session.source_plan_name ?? 'Observation Session',
          status: session.execution_status ?? 'active',
          planDate: session.date,
          notes: session.notes,
          weatherSnapshot: session.weather_snapshot as SessionWeatherSnapshot | undefined,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
          startedAt: session.start_time,
          endedAt: session.end_time,
          summary: session.execution_summary
            ? {
                completedTargets: session.execution_summary.completed_targets,
                skippedTargets: session.execution_summary.skipped_targets,
                failedTargets: session.execution_summary.failed_targets,
                totalTargets: session.execution_summary.total_targets,
                totalObservations: session.execution_summary.total_observations,
              }
            : undefined,
          targets: (session.execution_targets ?? []).map(mapSnapshotTarget),
        };

        set((state) => ({
          executions: upsertExecution(state.executions, execution),
          activeExecutionId: execution.id,
        }));
        return execution.id;
      },

      updateExecutionTarget: (executionId, targetId, updates) => {
        set((state) => ({
          executions: state.executions.map((execution) =>
            execution.id !== executionId
              ? execution
              : {
                  ...execution,
                  updatedAt: new Date().toISOString(),
                  targets: execution.targets.map((target) =>
                    target.targetId === targetId
                      ? { ...target, ...updates }
                      : target,
                  ),
                },
          ),
        }));
      },

      attachObservationToExecutionTarget: (executionId, targetId, observationId) => {
        set((state) => ({
          executions: state.executions.map((execution) =>
            execution.id !== executionId
              ? execution
              : {
                  ...execution,
                  updatedAt: new Date().toISOString(),
                  targets: execution.targets.map((target) =>
                    target.targetId !== targetId
                      ? target
                      : {
                          ...target,
                          status: target.status === 'planned' ? 'completed' : target.status,
                          observationIds: target.observationIds.includes(observationId)
                            ? target.observationIds
                            : [...target.observationIds, observationId],
                        },
                  ),
                },
          ),
        }));
      },

      completeExecution: (executionId, summary) => {
        set((state) => ({
          executions: state.executions.map((execution) =>
            execution.id !== executionId
              ? execution
              : {
                  ...execution,
                  status: 'completed',
                  summary,
                  endedAt: execution.endedAt ?? new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
          ),
        }));
      },

      archiveExecution: (executionId) => {
        set((state) => ({
          executions: state.executions.map((execution) =>
            execution.id !== executionId
              ? execution
              : {
                  ...execution,
                  status: 'archived',
                  updatedAt: new Date().toISOString(),
                },
          ),
          activeExecutionId: state.activeExecutionId === executionId ? null : state.activeExecutionId,
        }));
      },
    }),
    {
      name: 'skymap-session-plans',
      version: 3,
      storage: getZustandStorage<Partial<SessionPlanState>>(),
      migrate: (persistedState: unknown, version: number) => {
        const state = (persistedState ?? {}) as Partial<SessionPlanState>;
        if (version < 2) {
          return {
            savedPlans: state.savedPlans ?? [],
            activePlanId: state.activePlanId ?? null,
            templates: [],
            executions: [],
            activeExecutionId: null,
          } as Partial<SessionPlanState>;
        }
        if (version < 3) {
          return {
            savedPlans: state.savedPlans ?? [],
            activePlanId: state.activePlanId ?? null,
            templates: state.templates ?? [],
            executions: [],
            activeExecutionId: null,
          } as Partial<SessionPlanState>;
        }
        return {
          savedPlans: state.savedPlans ?? [],
          activePlanId: state.activePlanId ?? null,
          templates: state.templates ?? [],
          executions: state.executions ?? [],
          activeExecutionId: state.activeExecutionId ?? null,
        } as Partial<SessionPlanState>;
      },
      partialize: (state) => ({
        savedPlans: state.savedPlans,
        activePlanId: state.activePlanId,
        templates: state.templates,
        executions: state.executions,
        activeExecutionId: state.activeExecutionId,
      }),
    }
  )
);
