# Observation Execution Chain Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a unified observation workflow that turns a saved session plan into an active execution session, lets users track per-target progress inside Observation Log, links observations back to planned targets, and exports real execution results without breaking existing manual logs or saved templates.

**Architecture:** Keep `SavedSessionPlan` and `SessionDraftV2` as the planning-stage snapshot, but introduce an execution layer shared by the front-end store and the Tauri observation log model. `useSessionPlanStore` gains persisted execution-cache actions for resume/recovery, while `ObservationSession` becomes the execution-stage source of truth by gaining optional planning/execution fields plus a dedicated `create_planned_session` command. `SessionPlanner` starts or resumes execution, `ObservationLog` becomes the execution workspace, and a new `execution-exporter` generates markdown/json/csv result summaries that reuse the existing `sessionIo.exportSessionPlan` save command.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand persist, next-intl, Tauri 2.9, Rust `serde`/`chrono`, Jest + React Testing Library, Cargo tests

---

**Implementation note:** This plan intentionally omits `git commit` steps because the repository instructions say not to create commits unless the user explicitly asks for them.

### Task 1: Add execution domain types and Zustand actions

**Files:**
- Modify: `types/starmap/session-planner-v2.ts`
- Modify: `lib/stores/session-plan-store.ts`
- Modify: `lib/stores/index.ts`
- Test: `lib/stores/__tests__/session-plan-store.test.ts`

**Step 1: Write the failing store tests**

```ts
import { useSessionPlanStore } from '@/lib/stores/session-plan-store';

function makeSavedPlan() {
  return {
    name: 'Tonight Plan',
    planDate: '2026-03-06T00:00:00.000Z',
    latitude: 31.23,
    longitude: 121.47,
    strategy: 'balanced' as const,
    minAltitude: 30,
    minImagingTime: 30,
    constraints: {
      minAltitude: 30,
      minImagingTime: 30,
      minMoonDistance: 20,
      useExposurePlanDuration: true,
      weatherLimits: { maxCloudCover: 70, maxHumidity: 90, maxWindSpeed: 25 },
      safetyLimits: { enforceMountSafety: false, avoidMeridianFlipWindow: false },
    },
    planningMode: 'auto' as const,
    targets: [
      {
        targetId: 'm31',
        targetName: 'M31',
        ra: 10.68,
        dec: 41.27,
        startTime: '2026-03-06T12:00:00.000Z',
        endTime: '2026-03-06T13:30:00.000Z',
        duration: 1.5,
        maxAltitude: 72,
        moonDistance: 88,
        feasibilityScore: 90,
        order: 1,
      },
    ],
    excludedTargetIds: [],
    totalImagingTime: 1.5,
    nightCoverage: 45,
    efficiency: 100,
    notes: 'Clear night',
    weatherSnapshot: undefined,
    manualEdits: [],
  };
}

describe('session-plan-store execution workflow', () => {
  beforeEach(() => {
    useSessionPlanStore.setState({
      savedPlans: [],
      templates: [],
      activePlanId: null,
      executions: [],
      activeExecutionId: null,
    });
  });

  it('creates an active execution from a saved plan', () => {
    const planId = useSessionPlanStore.getState().savePlan(makeSavedPlan());
    const saved = useSessionPlanStore.getState().getPlanById(planId)!;
    const executionId = useSessionPlanStore.getState().createExecutionFromPlan(saved, {
      locationId: 'loc-1',
      locationName: 'Backyard',
    });

    const state = useSessionPlanStore.getState();
    expect(state.activeExecutionId).toBe(executionId);
    expect(state.executions[0].sourcePlanId).toBe(planId);
    expect(state.executions[0].targets[0].status).toBe('planned');
  });

  it('attaches an observation id to the matching execution target', () => {
    const state = useSessionPlanStore.getState();
    const executionId = state.createExecutionFromPlan(
      { ...makeSavedPlan(), id: 'plan-1', createdAt: '', updatedAt: '' },
      { locationId: 'loc-1', locationName: 'Backyard' },
    );

    state.attachObservationToExecutionTarget(executionId, 'm31', 'obs-1');

    expect(useSessionPlanStore.getState().executions[0].targets[0].observationIds).toEqual(['obs-1']);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand lib/stores/__tests__/session-plan-store.test.ts`

Expected: FAIL with missing `executions`, `activeExecutionId`, or `createExecutionFromPlan` store members.

**Step 3: Write minimal implementation**

```ts
export type SessionExecutionStatus =
  | 'draft'
  | 'ready'
  | 'active'
  | 'completed'
  | 'archived'
  | 'cancelled';

export type ExecutionTargetStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'failed';

export interface PlannedSessionExecutionTarget {
  id: string;
  targetId: string;
  targetName: string;
  scheduledStart: string;
  scheduledEnd: string;
  scheduledDurationMinutes: number;
  order: number;
  status: ExecutionTargetStatus;
  observationIds: string[];
  actualStart?: string;
  actualEnd?: string;
  resultNotes?: string;
  skipReason?: string;
  unplanned?: boolean;
}

export interface PlannedSessionExecution {
  id: string;
  sourcePlanId: string;
  sourcePlanName: string;
  status: SessionExecutionStatus;
  planDate: string;
  locationId?: string;
  locationName?: string;
  notes?: string;
  weatherSnapshot?: SessionWeatherSnapshot;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  endedAt?: string;
  targets: PlannedSessionExecutionTarget[];
}
```

```ts
executions: [],
activeExecutionId: null,
createExecutionFromPlan: (plan, context) => {
  const now = new Date().toISOString();
  const execution = {
    id: `execution-${Date.now()}`,
    sourcePlanId: plan.id,
    sourcePlanName: plan.name,
    status: 'ready',
    planDate: plan.planDate,
    locationId: context.locationId,
    locationName: context.locationName,
    notes: plan.notes,
    weatherSnapshot: plan.weatherSnapshot,
    createdAt: now,
    updatedAt: now,
    targets: plan.targets.map((target) => ({
      id: `${plan.id}-${target.targetId}`,
      targetId: target.targetId,
      targetName: target.targetName,
      scheduledStart: target.startTime,
      scheduledEnd: target.endTime,
      scheduledDurationMinutes: Math.max(1, Math.round((target.duration || 0) * 60)),
      order: target.order,
      status: 'planned',
      observationIds: [],
    })),
  } satisfies PlannedSessionExecution;

  set((state) => ({
    executions: [execution, ...state.executions],
    activeExecutionId: execution.id,
  }));
  return execution.id;
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
```

Also add:

- `syncExecutionFromObservationSession`
- `updateExecutionTarget`
- `completeExecution`
- `archiveExecution`
- `persist` `version: 2`
- `migrate` to seed `executions ?? []` and `activeExecutionId ?? null`

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand lib/stores/__tests__/session-plan-store.test.ts`

Expected: PASS

**Step 5: Run typecheck for the new store surface**

Run: `pnpm exec tsc --noEmit`

Expected: PASS

### Task 2: Extend Tauri observation models for execution-stage truth

**Files:**
- Modify: `lib/tauri/types.ts`
- Modify: `lib/tauri/api.ts`
- Modify: `lib/tauri/__tests__/api.test.ts`
- Modify: `src-tauri/src/data/observation_log.rs`
- Modify: `src-tauri/src/data/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Write the failing TypeScript API test**

```ts
it('createPlannedSession forwards the execution payload', async () => {
  mockInvoke.mockResolvedValueOnce({ id: 'session-1', execution_status: 'active', observations: [] });

  await observationLogApi.createPlannedSession({
    planDate: '2026-03-06',
    locationId: 'loc-1',
    locationName: 'Backyard',
    sourcePlanId: 'plan-1',
    sourcePlanName: 'Tonight Plan',
    executionTargets: [
      {
        id: 'plan-1-m31',
        targetId: 'm31',
        targetName: 'M31',
        scheduledStart: '2026-03-06T12:00:00.000Z',
        scheduledEnd: '2026-03-06T13:30:00.000Z',
        scheduledDurationMinutes: 90,
        order: 1,
        status: 'planned',
        observationIds: [],
      },
    ],
  });

  expect(mockInvoke).toHaveBeenCalledWith('create_planned_session', {
    payload: expect.objectContaining({
      sourcePlanId: 'plan-1',
      executionTargets: expect.any(Array),
    }),
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand lib/tauri/__tests__/api.test.ts`

Expected: FAIL because `createPlannedSession` and `create_planned_session` do not exist yet.

**Step 3: Write the failing Rust compatibility test**

```rust
#[test]
fn test_observation_session_deserializes_without_execution_fields() {
    let json = r#"{
        "id": "s1",
        "date": "2026-03-06",
        "location_id": null,
        "location_name": "Backyard",
        "start_time": null,
        "end_time": null,
        "weather": null,
        "seeing": null,
        "transparency": null,
        "equipment_ids": [],
        "notes": null,
        "observations": [],
        "created_at": "2026-03-06T12:00:00Z",
        "updated_at": "2026-03-06T12:00:00Z"
    }"#;

    let session: ObservationSession = serde_json::from_str(json).unwrap();
    assert!(session.execution_targets.is_none());
    assert!(session.source_plan_id.is_none());
}
```

**Step 4: Run test to verify it fails**

Run: `cargo test observation_log::tests:: -- --nocapture`

Expected: FAIL because the new execution fields are missing.

**Step 5: Implement the minimal Tauri contract**

```ts
export interface ObservationExecutionTarget {
  id: string;
  target_id: string;
  target_name: string;
  scheduled_start: string;
  scheduled_end: string;
  scheduled_duration_minutes: number;
  order: number;
  status: 'planned' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  observation_ids: string[];
  actual_start?: string;
  actual_end?: string;
  skip_reason?: string;
  result_notes?: string;
  unplanned?: boolean;
}

export interface ExecutionSummary {
  completed_targets: number;
  skipped_targets: number;
  failed_targets: number;
  total_targets: number;
  total_observations: number;
}

export interface ObservationSession {
  // existing fields...
  source_plan_id?: string;
  source_plan_name?: string;
  execution_status?: 'draft' | 'ready' | 'active' | 'completed' | 'archived' | 'cancelled';
  execution_targets?: ObservationExecutionTarget[];
  weather_snapshot?: unknown;
  execution_summary?: ExecutionSummary;
}
```

```ts
async createPlannedSession(payload: CreatePlannedSessionPayload): Promise<ObservationSession> {
  const invoke = await getInvoke();
  return invoke('create_planned_session', { payload });
}
```

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTarget {
    pub id: String,
    pub target_id: String,
    pub target_name: String,
    pub scheduled_start: DateTime<Utc>,
    pub scheduled_end: DateTime<Utc>,
    pub scheduled_duration_minutes: i64,
    pub order: usize,
    pub status: String,
    pub observation_ids: Vec<String>,
    pub actual_start: Option<DateTime<Utc>>,
    pub actual_end: Option<DateTime<Utc>>,
    pub skip_reason: Option<String>,
    pub result_notes: Option<String>,
    pub unplanned: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionSummary {
    pub completed_targets: usize,
    pub skipped_targets: usize,
    pub failed_targets: usize,
    pub total_targets: usize,
    pub total_observations: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObservationSession {
    // existing fields...
    pub source_plan_id: Option<String>,
    pub source_plan_name: Option<String>,
    pub execution_status: Option<String>,
    pub execution_targets: Option<Vec<ExecutionTarget>>,
    pub weather_snapshot: Option<serde_json::Value>,
    pub execution_summary: Option<ExecutionSummary>,
}
```

Add a new command:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePlannedSessionPayload {
    pub plan_date: NaiveDate,
    pub location_id: Option<String>,
    pub location_name: Option<String>,
    pub source_plan_id: String,
    pub source_plan_name: String,
    pub notes: Option<String>,
    pub weather_snapshot: Option<serde_json::Value>,
    pub execution_targets: Vec<ExecutionTarget>,
}

#[tauri::command]
pub async fn create_planned_session(
    app: AppHandle,
    payload: CreatePlannedSessionPayload,
) -> Result<ObservationSession, StorageError> {
    // create an ObservationSession with execution_status = Some("active".to_string())
}
```

Also wire `create_planned_session` through:

- `src-tauri/src/data/mod.rs`
- `src-tauri/src/lib.rs`

**Step 6: Run tests to verify they pass**

Run:
- `pnpm test -- --runInBand lib/tauri/__tests__/api.test.ts`
- `cargo test observation_log::tests:: -- --nocapture`

Expected: PASS

### Task 3: Start and resume execution from Session Planner

**Files:**
- Modify: `components/starmap/planning/session-planner.tsx`
- Modify: `components/starmap/planning/__tests__/session-planner.test.tsx`
- Modify: `i18n/messages/en.json`
- Modify: `i18n/messages/zh.json`

**Step 1: Write the failing component test**

```tsx
it('starts a planned session from the current saved plan', async () => {
  mockCreatePlannedSession.mockResolvedValue(makePlannedObservationSession());

  render(<SessionPlanner />);

  await user.click(screen.getByRole('button', { name: /Save Plan/i }));
  await user.click(screen.getByRole('button', { name: /Start Execution/i }));

  expect(mockCreatePlannedSession).toHaveBeenCalledWith(
    expect.objectContaining({
      sourcePlanId: expect.any(String),
      executionTargets: expect.arrayContaining([
        expect.objectContaining({ targetId: expect.any(String) }),
      ]),
    }),
  );
  expect(screen.getByText(/Execution In Progress/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/starmap/planning/__tests__/session-planner.test.tsx`

Expected: FAIL because no `Start Execution` button or execution banner exists.

**Step 3: Implement the planner execution actions**

Add UI and handlers for:

- `Start Execution`
- `Continue Execution`
- execution status banner

Suggested implementation shape:

```ts
const activeExecutionId = useSessionPlanStore((state) => state.activeExecutionId);
const executions = useSessionPlanStore((state) => state.executions);
const syncExecutionFromObservationSession = useSessionPlanStore((state) => state.syncExecutionFromObservationSession);

const relatedExecution = useMemo(
  () => executions.find((execution) => execution.sourcePlanId === activePlanId && execution.status !== 'archived'),
  [executions, activePlanId],
);

const handleStartExecution = useCallback(async () => {
  const savedPlanId = handleSavePlan();
  const savedPlan = useSessionPlanStore.getState().getPlanById(savedPlanId);
  if (!savedPlan || !isTauri()) return;

  const session = await tauriApi.observationLog.createPlannedSession({
    planDate: savedPlan.planDate.slice(0, 10),
    locationId: currentLocationId,
    locationName: currentLocationName,
    sourcePlanId: savedPlan.id,
    sourcePlanName: savedPlan.name,
    notes: savedPlan.notes,
    weatherSnapshot: savedPlan.weatherSnapshot,
    executionTargets: savedPlan.targets.map((target) => ({
      id: `${savedPlan.id}-${target.targetId}`,
      targetId: target.targetId,
      targetName: target.targetName,
      scheduledStart: target.startTime,
      scheduledEnd: target.endTime,
      scheduledDurationMinutes: Math.max(1, Math.round(target.duration * 60)),
      order: target.order,
      status: 'planned',
      observationIds: [],
    })),
  });

  syncExecutionFromObservationSession(session);
  toast.success(t('sessionPlanner.executionStarted'));
});
```

Also:

- if an active execution already exists for the current plan, show `Continue Execution`
- disable `Start Execution` when `displayedPlan.targets.length === 0`
- add status labels and badges to each timeline item

**Step 4: Run the planner test**

Run: `pnpm test -- --runInBand components/starmap/planning/__tests__/session-planner.test.tsx`

Expected: PASS

**Step 5: Run typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: PASS

### Task 4: Turn Observation Log into the execution workspace

**Files:**
- Modify: `components/starmap/planning/observation-log.tsx`
- Modify: `components/starmap/planning/__tests__/observation-log.test.tsx`
- Modify: `i18n/messages/en.json`
- Modify: `i18n/messages/zh.json`

**Step 1: Write the failing Observation Log test**

```tsx
it('renders the active execution targets and updates target status', async () => {
  mockLoad.mockResolvedValue({
    sessions: [makePlannedObservationSession()],
  });

  render(<ObservationLog currentSelection={null} />);
  await user.click(screen.getByRole('button'));

  expect(await screen.findByText('M31')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Start Target/i }));

  expect(mockUpdateSession).toHaveBeenCalledWith(
    expect.objectContaining({
      execution_targets: expect.arrayContaining([
        expect.objectContaining({ target_id: 'm31', status: 'in_progress' }),
      ]),
    }),
  );
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/starmap/planning/__tests__/observation-log.test.tsx`

Expected: FAIL because the execution workspace UI does not exist.

**Step 3: Implement execution-session aware Observation Log**

Add:

- active execution summary card
- `Planned Targets` tab
- `Observations` tab
- per-target buttons:
  - `Start Target`
  - `Complete`
  - `Skip`
  - `Add Observation`
  - `View Observations`

Suggested session-update helper:

```ts
const updateExecutionTargetStatus = useCallback(
  async (session: ObservationSession, targetId: string, status: ObservationExecutionTarget['status']) => {
    const nextSession: ObservationSession = {
      ...session,
      execution_targets: (session.execution_targets ?? []).map((target) =>
        target.target_id !== targetId
          ? target
          : {
              ...target,
              status,
              actual_start: status === 'in_progress' ? new Date().toISOString() : target.actual_start,
              actual_end: status === 'completed' ? new Date().toISOString() : target.actual_end,
            },
      ),
    };

    const updated = await tauriApi.observationLog.updateSession(nextSession);
    setSelectedSession(updated);
    syncExecutionFromObservationSession(updated);
  },
  [syncExecutionFromObservationSession],
);
```

Change observation creation so the payload carries execution linkage:

```ts
await tauriApi.observationLog.addObservation(selectedSession.id, {
  object_name: obsObjectName,
  object_type: obsObjectType || undefined,
  telescope_id: obsTelescopeId || undefined,
  camera_id: obsCameraId || undefined,
  rating: obsRating,
  difficulty: obsDifficulty,
  notes: obsNotes || undefined,
  image_paths: [],
  execution_target_id: selectedExecutionTargetId || undefined,
});
```

Also:

- replace the old `Create Draft from Planner` shortcut with explicit execution actions
- keep manual session creation available
- if the user adds a target not in the plan, append a new `unplanned` execution target to the session before saving

**Step 4: Run the Observation Log test**

Run: `pnpm test -- --runInBand components/starmap/planning/__tests__/observation-log.test.tsx`

Expected: PASS

**Step 5: Run the focused UI regression pair**

Run:
- `pnpm test -- --runInBand components/starmap/planning/__tests__/session-planner.test.tsx`
- `pnpm test -- --runInBand components/starmap/planning/__tests__/observation-log.test.tsx`

Expected: PASS

### Task 5: Add execution-result export and completion summary

**Files:**
- Add: `lib/astronomy/execution-exporter.ts`
- Add: `lib/astronomy/__tests__/execution-exporter.test.ts`
- Modify: `components/starmap/planning/observation-log.tsx`
- Modify: `i18n/messages/en.json`
- Modify: `i18n/messages/zh.json`

**Step 1: Write the failing exporter test**

```ts
import { exportExecutionSummary } from '@/lib/astronomy/execution-exporter';

it('exports markdown summary with completed and skipped targets', () => {
  const output = exportExecutionSummary(makeExecutionSession(), {
    format: 'markdown',
  });

  expect(output).toContain('# Observation Execution Summary');
  expect(output).toContain('M31');
  expect(output).toContain('completed');
});

it('exports json summary with execution metadata', () => {
  const output = exportExecutionSummary(makeExecutionSession(), {
    format: 'json',
  });

  const parsed = JSON.parse(output);
  expect(parsed.sourcePlanId).toBe('plan-1');
  expect(parsed.targets).toHaveLength(1);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand lib/astronomy/__tests__/execution-exporter.test.ts`

Expected: FAIL because the exporter module does not exist.

**Step 3: Implement the exporter and completion flow**

```ts
export type ExecutionExportFormat = 'markdown' | 'json' | 'csv';

export function exportExecutionSummary(
  session: ObservationSession,
  options: { format: ExecutionExportFormat },
): string {
  switch (options.format) {
    case 'json':
      return JSON.stringify({
        sessionId: session.id,
        sourcePlanId: session.source_plan_id,
        sourcePlanName: session.source_plan_name,
        executionStatus: session.execution_status,
        summary: session.execution_summary,
        targets: session.execution_targets ?? [],
        observations: session.observations ?? [],
      }, null, 2);
    case 'csv':
      return [
        'order,target_name,status,scheduled_start,scheduled_end,actual_start,actual_end,observation_count',
        ...(session.execution_targets ?? []).map((target) =>
          [
            target.order,
            JSON.stringify(target.target_name),
            target.status,
            target.scheduled_start,
            target.scheduled_end,
            target.actual_start ?? '',
            target.actual_end ?? '',
            target.observation_ids.length,
          ].join(',')
        ),
      ].join('\n');
    default:
      return `# Observation Execution Summary\n\n- Plan: ${session.source_plan_name ?? 'Unknown'}\n- Status: ${session.execution_status ?? 'unknown'}`;
  }
}
```

In `ObservationLog`:

- compute `execution_summary` when the user clicks `End Execution`
- persist the updated session via `updateSession`
- add export buttons for `markdown`, `json`, and `csv`
- save via `tauriApi.sessionIo.exportSessionPlan(content, format)`

**Step 4: Run exporter and Observation Log tests**

Run:
- `pnpm test -- --runInBand lib/astronomy/__tests__/execution-exporter.test.ts`
- `pnpm test -- --runInBand components/starmap/planning/__tests__/observation-log.test.tsx`

Expected: PASS

### Task 6: Update contracts and run the focused verification suite

**Files:**
- Modify: `docs/reference/observation-system-contracts.md`
- Modify: `types/starmap/session-planner-v2.ts`
- Modify: `lib/tauri/types.ts`
- Modify: `src-tauri/src/data/observation_log.rs`

**Step 1: Document the execution contract**

Add a new section to `docs/reference/observation-system-contracts.md` covering:

- execution-stage source of truth = `ObservationSession`
- required status enums
- target linkage rule via `execution_target_id`
- compatibility rule for old sessions with missing execution fields

**Step 2: Run the focused verification suite**

Run:
- `pnpm test -- --runInBand lib/stores/__tests__/session-plan-store.test.ts`
- `pnpm test -- --runInBand lib/tauri/__tests__/api.test.ts`
- `pnpm test -- --runInBand components/starmap/planning/__tests__/session-planner.test.tsx`
- `pnpm test -- --runInBand components/starmap/planning/__tests__/observation-log.test.tsx`
- `pnpm test -- --runInBand lib/astronomy/__tests__/execution-exporter.test.ts`
- `pnpm exec tsc --noEmit`
- `cargo test observation_log::tests:: -- --nocapture`

Expected: PASS with no new warnings or type errors in the touched areas.

**Step 3: Sanity-check the user-visible workflow**

Manually verify:

- save a plan
- start execution from the planner
- open Observation Log and see the active execution workspace
- add an observation linked to a planned target
- end execution and export a summary

Expected: the plan, execution state, observations, and exported result remain consistent across the same desktop session and after reload.
