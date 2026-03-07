# Project Error Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the current post-lint TypeScript and runtime-contract errors so the project passes `pnpm exec tsc --noEmit` and the touched regression tests.

**Architecture:** Fix the failing areas by root cause instead of isolated casts. Unify the loading-state contract shared by Stellarium and Aladin loaders, align target-list deserialization typing with the actual payload handling path, and add explicit typing for the updater manifest builder so CommonJS imports remain type-safe from TypeScript tests.

**Tech Stack:** TypeScript, React 19 hooks, Zustand, Jest, Node.js CommonJS scripts

---

## References

- Use `@systematic-debugging` before each fix batch
- Use `@test-driven-development` with the existing failing `tsc` and focused Jest tests as red-state evidence
- Before completion, run `@verification-before-completion`

### Task 1: Restore the Shared Loading State Contract

**Files:**
- Modify: `types/stellarium-canvas.ts`
- Modify: `lib/hooks/stellarium/use-stellarium-loader.ts`
- Modify: `lib/hooks/aladin/use-aladin-loader.ts`
- Test: `lib/hooks/stellarium/__tests__/use-stellarium-loader.test.ts`
- Test: `lib/hooks/aladin/__tests__/use-aladin-loader.test.ts`
- Test: `components/starmap/canvas/__tests__/loading-overlay.test.tsx`

**Step 1: Verify red state**

Run: `pnpm exec tsc --noEmit`  
Expected: FAIL on missing `phase` / `errorCode` in `LoadingState`.

**Step 2: Implement the minimal contract**

Add shared loading-state phase and error-code fields, then populate them in both loader hooks with the semantics already asserted by tests:
- Stellarium starts in `preparing`
- Stellarium overall timeout ends in `timed_out` + `overall_timeout`
- Aladin idle starts in `idle`
- Aladin missing container ends in `failed` + `container_not_ready`

**Step 3: Run focused tests**

Run:

```bash
pnpm test -- --runInBand lib/hooks/stellarium/__tests__/use-stellarium-loader.test.ts
pnpm test -- --runInBand lib/hooks/aladin/__tests__/use-aladin-loader.test.ts
pnpm test -- --runInBand components/starmap/canvas/__tests__/loading-overlay.test.tsx
```

Expected: PASS.

### Task 2: Fix Target List Tauri Load Typing at the Deserialization Boundary

**Files:**
- Modify: `lib/stores/target-list-store.ts`
- Modify: `lib/tauri/target-list-api.ts` (only if shared payload typing is needed)

**Step 1: Verify red state**

Run: `pnpm exec tsc --noEmit`  
Expected: FAIL on `TargetListData` to `Record<string, unknown>` conversion in `lib/stores/target-list-store.ts`.

**Step 2: Implement the minimal type-safe boundary**

Replace the invalid direct cast with a boundary type that reflects what the store is actually doing when it reads raw persisted payload keys.

**Step 3: Re-run typecheck**

Run: `pnpm exec tsc --noEmit`  
Expected: target-list-store error disappears.

### Task 3: Type the Updater Manifest Builder Across the CommonJS Boundary

**Files:**
- Modify: `scripts/updater/build-latest-json.cjs`
- Test: `scripts/updater/__tests__/build-latest-json.test.ts`

**Step 1: Verify red state**

Run: `pnpm exec tsc --noEmit`  
Expected: FAIL because `manifest.platforms` is inferred as `{}` in the TypeScript test.

**Step 2: Add minimal explicit typing**

Use JSDoc typedefs or equivalent minimal typing so `buildLatestManifest()` exposes `platforms` as `Record<string, { signature: string; url: string }>` without changing runtime behavior.

**Step 3: Run focused updater test**

Run: `pnpm test -- --runInBand scripts/updater/__tests__/build-latest-json.test.ts`  
Expected: PASS.

### Task 4: Final Verification

**Files:**
- Modify: any files changed above

**Step 1: Run final typecheck**

Run: `pnpm exec tsc --noEmit`  
Expected: exit code 0.

**Step 2: Run final lint regression**

Run: `pnpm lint`  
Expected: exit code 0.
