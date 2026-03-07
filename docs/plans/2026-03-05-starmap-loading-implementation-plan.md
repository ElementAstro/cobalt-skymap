# Star Map Loading System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the full star map loading pipeline stable and behaviorally consistent across Stellarium, Aladin, and Splash lifecycle, verified by automated tests only.

**Architecture:** Keep the existing canvas/view/store layering and harden it with a shared loading-state contract. Unify loader semantics (status, retries, timeout terminal states, readiness semantics) while preserving manual retry and no automatic engine fallback. Drive all changes with small TDD loops and frequent commits.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, Jest + React Testing Library

---

## References

- Design doc: `docs/plans/2026-03-05-starmap-loading-design.md`
- Use @test-driven-development for each task
- Before completion, run @verification-before-completion checks

### Task 1: Define Unified Loading State Contract

**Files:**
- Modify: `types/stellarium-canvas.ts`
- Test: `components/starmap/canvas/__tests__/loading-overlay.test.tsx`

**Step 1: Write the failing test**

```tsx
it('supports unified loading metadata fields', () => {
  const state = {
    isLoading: true,
    loadingStatus: 'initializing',
    errorMessage: null,
    startTime: Date.now(),
    progress: 10,
    phase: 'initializing_engine',
    errorCode: null,
    retryCount: 0,
    sessionId: 's1',
    deadlineAt: Date.now() + 1000,
  };
  expect(state.phase).toBe('initializing_engine');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/starmap/canvas/__tests__/loading-overlay.test.tsx`  
Expected: FAIL on `LoadingState` typing mismatch.

**Step 3: Write minimal implementation**

```ts
export type EngineLoadingPhase =
  | 'idle'
  | 'preparing'
  | 'loading_script'
  | 'initializing_engine'
  | 'ready'
  | 'retrying'
  | 'failed'
  | 'timed_out';

export type EngineLoadingErrorCode =
  | 'container_not_ready'
  | 'script_timeout'
  | 'script_failed'
  | 'engine_timeout'
  | 'engine_init_failed'
  | 'overall_timeout'
  | 'unknown';
```

Add optional fields to `LoadingState`: `phase`, `errorCode`, `retryCount`, `sessionId`, `deadlineAt`.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand components/starmap/canvas/__tests__/loading-overlay.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add types/stellarium-canvas.ts components/starmap/canvas/__tests__/loading-overlay.test.tsx
git commit -m "refactor: add unified engine loading state contract"
```

### Task 2: Harden Stellarium Loader Session and Terminal-State Semantics

**Files:**
- Modify: `lib/hooks/stellarium/use-stellarium-loader.ts`
- Test: `lib/hooks/stellarium/__tests__/use-stellarium-loader.test.ts`

**Step 1: Write the failing test**

```ts
it('marks timed_out phase when overall deadline is exceeded', async () => {
  // setup with never-ready container/canvas
  // call startLoading and advance timers beyond OVERALL_LOADING_TIMEOUT
  // expect loadingState.phase === 'timed_out'
  // expect loadingState.errorCode === 'overall_timeout'
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand lib/hooks/stellarium/__tests__/use-stellarium-loader.test.ts`  
Expected: FAIL because phase/errorCode are not asserted by current loader.

**Step 3: Write minimal implementation**

```ts
const sessionIdRef = useRef<string>('');
const newSessionId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// on new load session:
sessionIdRef.current = newSessionId();
setLoadingState((prev) => ({
  ...prev,
  phase: 'preparing',
  sessionId: sessionIdRef.current,
  deadlineAt: overallDeadlineRef.current,
}));
```

Ensure terminal transitions set:
- `phase: 'ready'` on success
- `phase: 'failed'` on non-timeout terminal errors
- `phase: 'timed_out'` and `errorCode: 'overall_timeout'` on overall timeout.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand lib/hooks/stellarium/__tests__/use-stellarium-loader.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/hooks/stellarium/use-stellarium-loader.ts lib/hooks/stellarium/__tests__/use-stellarium-loader.test.ts
git commit -m "fix(stellarium-loader): enforce session and timed_out terminal semantics"
```

### Task 3: Align Aladin Loader with the Same Contract

**Files:**
- Modify: `lib/hooks/aladin/use-aladin-loader.ts`
- Test: `lib/hooks/aladin/__tests__/use-aladin-loader.test.ts`

**Step 1: Write the failing test**

```ts
it('uses same phase semantics as stellarium loader', async () => {
  // startLoading()
  // expect phase transitions to include preparing/initializing_engine
  // on error expect failed or timed_out terminal phase
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand lib/hooks/aladin/__tests__/use-aladin-loader.test.ts`  
Expected: FAIL on missing contract fields and phase values.

**Step 3: Write minimal implementation**

```ts
setLoadingState({
  isLoading: true,
  loadingStatus: 'Loading Aladin Lite WASM...',
  errorMessage: null,
  startTime: Date.now(),
  progress: 20,
  phase: 'preparing',
  errorCode: null,
  retryCount: 0,
  sessionId,
  deadlineAt,
});
```

Add retry count/deadline-aware transitions and terminal mapping compatible with Stellarium semantics.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand lib/hooks/aladin/__tests__/use-aladin-loader.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/hooks/aladin/use-aladin-loader.ts lib/hooks/aladin/__tests__/use-aladin-loader.test.ts
git commit -m "fix(aladin-loader): align with unified loading phase contract"
```

### Task 4: Normalize Canvas `getEngineStatus()` Readiness Rules

**Files:**
- Modify: `components/starmap/canvas/stellarium-canvas.tsx`
- Modify: `components/starmap/canvas/aladin-canvas.tsx`
- Test: `components/starmap/canvas/__tests__/stellarium-canvas.test.tsx`
- Test: `components/starmap/canvas/__tests__/aladin-canvas.test.tsx`

**Step 1: Write the failing test**

```tsx
it('returns isReady false when engineReady=true but engine instance is null', () => {
  // mock engineReady true, ref null
  // expect getEngineStatus().isReady === false
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/starmap/canvas/__tests__/stellarium-canvas.test.tsx components/starmap/canvas/__tests__/aladin-canvas.test.tsx`  
Expected: FAIL for at least one engine path.

**Step 3: Write minimal implementation**

```ts
const getEngineStatus = useCallback(() => ({
  isLoading: loadingState.isLoading,
  hasError: loadingState.errorMessage !== null,
  isReady: engineReady && engineRef.current !== null,
}), [loadingState.isLoading, loadingState.errorMessage, engineReady]);
```

Apply same semantics in both engine canvas components.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand components/starmap/canvas/__tests__/stellarium-canvas.test.tsx components/starmap/canvas/__tests__/aladin-canvas.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add components/starmap/canvas/stellarium-canvas.tsx components/starmap/canvas/aladin-canvas.tsx components/starmap/canvas/__tests__/stellarium-canvas.test.tsx components/starmap/canvas/__tests__/aladin-canvas.test.tsx
git commit -m "fix(canvas): unify engine readiness status semantics"
```

### Task 5: Make LoadingOverlay Handle Unified Terminal Phases Consistently

**Files:**
- Modify: `components/starmap/canvas/components/loading-overlay.tsx`
- Test: `components/starmap/canvas/__tests__/loading-overlay.test.tsx`

**Step 1: Write the failing test**

```tsx
it('shows retry for failed and timed_out phases', () => {
  const state = makeState({ isLoading: false, phase: 'timed_out', errorMessage: 'overallTimeout' });
  render(<LoadingOverlay loadingState={state} onRetry={onRetry} />);
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/starmap/canvas/__tests__/loading-overlay.test.tsx`  
Expected: FAIL on missing phase-driven behavior.

**Step 3: Write minimal implementation**

```tsx
const terminalFailure = loadingState.phase === 'failed' || loadingState.phase === 'timed_out' || !!errorMessage;
if (!isLoading && !terminalFailure) return null;
```

Keep existing progress animation and retry callback unchanged.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand components/starmap/canvas/__tests__/loading-overlay.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add components/starmap/canvas/components/loading-overlay.tsx components/starmap/canvas/__tests__/loading-overlay.test.tsx
git commit -m "fix(loading-overlay): standardize terminal failure rendering"
```

### Task 6: Guarantee One-Time View Restore Across Engine Switching

**Files:**
- Modify: `components/starmap/canvas/sky-map-canvas.tsx`
- Modify: `components/starmap/canvas/stellarium-canvas.tsx`
- Modify: `components/starmap/canvas/aladin-canvas.tsx`
- Test: `components/starmap/canvas/__tests__/sky-map-canvas.test.tsx`

**Step 1: Write the failing test**

```tsx
it('restores saved view only once after engine switch', () => {
  // switch engine twice with same saved state
  // expect restore function / clearSavedViewState called once per restore cycle
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/starmap/canvas/__tests__/sky-map-canvas.test.tsx`  
Expected: FAIL if duplicate restore can happen.

**Step 3: Write minimal implementation**

```ts
const restoredViewRef = useRef(false);
if (engineReady && savedViewState && !restoredViewRef.current) {
  restoredViewRef.current = true;
  // restore view...
  clearSavedViewState();
}
```

Reset `restoredViewRef` on engine remount/switch.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand components/starmap/canvas/__tests__/sky-map-canvas.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add components/starmap/canvas/sky-map-canvas.tsx components/starmap/canvas/stellarium-canvas.tsx components/starmap/canvas/aladin-canvas.tsx components/starmap/canvas/__tests__/sky-map-canvas.test.tsx
git commit -m "fix(engine-switch): enforce one-time saved view restoration"
```

### Task 7: Verify Splash Early-Completion Linkage Remains Correct

**Files:**
- Modify: `components/starmap/feedback/__tests__/splash-screen.test.tsx`
- Modify: `app/starmap/page.tsx` (only if readiness mapping adjustment is required)

**Step 1: Write the failing test**

```tsx
it('completes early when engine readiness flips true and does not double-complete', () => {
  // render SplashScreen with isReady false then true
  // ensure onComplete called once
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/starmap/feedback/__tests__/splash-screen.test.tsx`  
Expected: FAIL if duplicate completion can occur in current linkage.

**Step 3: Write minimal implementation**

```tsx
if (!isReady || phase === 'fadeout') return;
const id = requestAnimationFrame(() => {
  if (isReadyRef.current) handleSkip();
});
```

If already equivalent, only keep/expand tests and avoid code changes (YAGNI).

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand components/starmap/feedback/__tests__/splash-screen.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add components/starmap/feedback/__tests__/splash-screen.test.tsx app/starmap/page.tsx
git commit -m "test(splash): lock early-ready completion and no-double-complete behavior"
```

### Task 8: Run Focused Regression Suite and Final Verification

**Files:**
- Modify: `docs/developer-guide/core-modules/starmap-core.md` (only if behavior docs changed)
- Test:
  - `lib/hooks/stellarium/__tests__/use-stellarium-loader.test.ts`
  - `lib/hooks/aladin/__tests__/use-aladin-loader.test.ts`
  - `components/starmap/canvas/__tests__/stellarium-canvas.test.tsx`
  - `components/starmap/canvas/__tests__/aladin-canvas.test.tsx`
  - `components/starmap/canvas/__tests__/loading-overlay.test.tsx`
  - `components/starmap/canvas/__tests__/sky-map-canvas.test.tsx`
  - `components/starmap/feedback/__tests__/splash-screen.test.tsx`

**Step 1: Run focused regression tests**

Run:

```bash
pnpm test -- --runInBand lib/hooks/stellarium/__tests__/use-stellarium-loader.test.ts
pnpm test -- --runInBand lib/hooks/aladin/__tests__/use-aladin-loader.test.ts
pnpm test -- --runInBand components/starmap/canvas/__tests__/stellarium-canvas.test.tsx
pnpm test -- --runInBand components/starmap/canvas/__tests__/aladin-canvas.test.tsx
pnpm test -- --runInBand components/starmap/canvas/__tests__/loading-overlay.test.tsx
pnpm test -- --runInBand components/starmap/canvas/__tests__/sky-map-canvas.test.tsx
pnpm test -- --runInBand components/starmap/feedback/__tests__/splash-screen.test.tsx
```

Expected: All PASS.

**Step 2: Run lint and typecheck gates**

Run:

```bash
pnpm lint
pnpm exec tsc --noEmit
```

Expected: no errors.

**Step 3: Update docs (if needed)**

If code semantics changed, update `docs/developer-guide/core-modules/starmap-core.md` with new phase names and terminal-state contract.

**Step 4: Final commit**

```bash
git add lib/hooks/stellarium/use-stellarium-loader.ts lib/hooks/aladin/use-aladin-loader.ts components/starmap/canvas/stellarium-canvas.tsx components/starmap/canvas/aladin-canvas.tsx components/starmap/canvas/components/loading-overlay.tsx components/starmap/canvas/sky-map-canvas.tsx lib/hooks/stellarium/__tests__/use-stellarium-loader.test.ts lib/hooks/aladin/__tests__/use-aladin-loader.test.ts components/starmap/canvas/__tests__/stellarium-canvas.test.tsx components/starmap/canvas/__tests__/aladin-canvas.test.tsx components/starmap/canvas/__tests__/loading-overlay.test.tsx components/starmap/canvas/__tests__/sky-map-canvas.test.tsx components/starmap/feedback/__tests__/splash-screen.test.tsx docs/developer-guide/core-modules/starmap-core.md
git commit -m "fix(starmap): harden and unify loading flow across engines"
```

