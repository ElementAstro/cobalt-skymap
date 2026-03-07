# Warning Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the remaining non-fatal warning noise from focused tests and full verification so the project is not only passing, but also quiet in the relevant test and build paths.

**Architecture:** Fix warning sources at their true boundary. Strip unsupported Next.js image props in the Jest mock rather than changing production image usage, wrap async test-triggered state updates in `act()` where the tests call component callbacks directly, correct the settings test select mocks so they do not render invalid DOM under native `<option>`, and refresh the stale `baseline-browser-mapping` package to silence the dependency freshness warning.

**Tech Stack:** Jest, React Testing Library, React 19, TypeScript, PNPM

---

## References

- Use `@systematic-debugging` before each fix batch
- Use `@test-driven-development` with the current warning repro runs as red-state evidence
- Before completion, run `@verification-before-completion`

### Task 1: Fix the Next Image Jest Mock

**Files:**
- Modify: `jest.setup.ts`
- Test: `components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx`

**Step 1: Verify red state**

Run: `pnpm test --runInBand components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx`  
Expected: PASS with a console warning about `unoptimized`.

**Step 2: Implement the minimal fix**

Update the `next/image` Jest mock to omit non-DOM props such as `priority`, `fill`, and `unoptimized` before rendering `<img>`.

**Step 3: Re-run focused test**

Run: `pnpm test --runInBand components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx`  
Expected: PASS without the `unoptimized` warning.

### Task 2: Wrap Direct Async Callback Invocations in `act()`

**Files:**
- Modify: `components/starmap/plate-solving/__tests__/plate-solver-unified.test.tsx`
- Modify: `components/starmap/management/__tests__/cache-layers-tab.test.tsx`

**Step 1: Verify red state**

Run:

```bash
pnpm test --runInBand components/starmap/plate-solving/__tests__/plate-solver-unified.test.tsx
pnpm test --runInBand components/starmap/management/__tests__/cache-layers-tab.test.tsx
```

Expected: PASS with `not wrapped in act(...)` warnings.

**Step 2: Implement the minimal fix**

Wrap the test-level direct async callback invocations and async click flows in `await act(async () => { ... })` so React observes the updates in the same turn.

**Step 3: Re-run focused tests**

Run the same commands again.  
Expected: PASS without `act(...)` warnings.

### Task 3: Fix Invalid Native `<option>` Test Mocks

**Files:**
- Modify: `components/starmap/settings/__tests__/camera-selector.test.tsx`
- Modify: `components/starmap/settings/__tests__/telescope-selector.test.tsx`
- Modify: `components/starmap/settings/__tests__/equipment-settings.test.tsx`

**Step 1: Verify red state**

Run:

```bash
pnpm test --runInBand components/starmap/settings/__tests__/camera-selector.test.tsx
pnpm test --runInBand components/starmap/settings/__tests__/telescope-selector.test.tsx
pnpm test --runInBand components/starmap/settings/__tests__/equipment-settings.test.tsx
```

Expected: PASS with warnings about invalid children inside `<option>` and complex option values.

**Step 2: Implement the minimal fix**

Adjust the local select mocks so `SelectItem` renders plain-text option content, preserving test behavior without invalid HTML.

**Step 3: Re-run focused tests**

Run the same commands again.  
Expected: PASS without `<option>` warnings.

### Task 4: Refresh `baseline-browser-mapping`

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: Verify red state**

Run: `pnpm test --runInBand components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx`  
Expected: warning advising `baseline-browser-mapping@latest`.

**Step 2: Implement the minimal fix**

Update `baseline-browser-mapping` from the current pinned version to the latest available version and refresh the lockfile.

**Step 3: Re-run a focused verification**

Run:

```bash
pnpm test --runInBand components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx
pnpm build
```

Expected: PASS without the stale baseline-browser-mapping warning.

### Task 5: Final Verification

**Files:**
- Modify: all changed files above

**Step 1: Run final gates**

Run:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test --runInBand
pnpm build
```

Expected: all commands exit with code 0, and the targeted warning classes are gone.
