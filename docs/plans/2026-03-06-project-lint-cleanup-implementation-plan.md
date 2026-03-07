# Project Lint Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the repository-wide ESLint run complete without errors by fixing configuration scope and the remaining real source violations.

**Architecture:** Treat the lint failures in two buckets: configuration noise from nested worktrees / generated artifacts, and genuine source violations in the updater script area. Fix the root cause in ESLint configuration first so the linter only scans the active project, then apply the smallest source changes needed for the updater files, and finally verify with fresh lint output.

**Tech Stack:** ESLint 9, Next.js 16, TypeScript, Jest, Node.js CommonJS scripts

---

## References

- Use `@systematic-debugging` before each fix batch
- Use `@test-driven-development` if a code change alters runtime behavior
- Before completion, run `@verification-before-completion`

### Task 1: Exclude Nested Worktrees and Derived Artifacts from ESLint

**Files:**
- Modify: `eslint.config.mjs`

**Step 1: Reproduce the current lint failure**

Run: `pnpm exec eslint . --format json --output-file eslint-report.json`  
Expected: FAIL with errors under `.worktrees/**` and `scripts/updater/**`.

**Step 2: Implement the minimal configuration fix**

Add ignore coverage for nested worktrees and any files underneath them so ESLint only scans the active repository tree.

**Step 3: Re-run lint to confirm `.worktrees/**` noise disappears**

Run: `pnpm exec eslint . --format json --output-file eslint-report.json`  
Expected: remaining failures only come from `scripts/updater/**`.

### Task 2: Resolve CommonJS Import Rule Violations in the Updater Script Area

**Files:**
- Modify: `eslint.config.mjs`
- Modify: `scripts/updater/__tests__/build-latest-json.test.ts`
- Modify: `scripts/updater/build-latest-json.cjs` (only if config-only fix is insufficient)

**Step 1: Inspect the remaining violations**

Read the `eslint-report.json` entries for:
- `scripts/updater/build-latest-json.cjs`
- `scripts/updater/__tests__/build-latest-json.test.ts`

Expected: `@typescript-eslint/no-require-imports` errors.

**Step 2: Apply the smallest safe fix**

Either:
- add a targeted ESLint override for CommonJS `.cjs` files, and
- refactor the TypeScript test to load the CommonJS module without forbidden `require()` usage,

or, if cleaner, migrate the script loading pattern in a way that preserves current runtime behavior.

**Step 3: Run the focused updater test**

Run: `pnpm test -- --runInBand scripts/updater/__tests__/build-latest-json.test.ts`  
Expected: PASS.

### Task 3: Final Verification

**Files:**
- Modify: `eslint.config.mjs`
- Modify: `scripts/updater/__tests__/build-latest-json.test.ts`
- Modify: `scripts/updater/build-latest-json.cjs` (if changed)

**Step 1: Run full lint**

Run: `pnpm lint`  
Expected: exit code 0 with no ESLint errors.

**Step 2: Summarize exact scope**

Report:
- which configuration root cause was fixed,
- which updater-file changes were needed,
- the final lint evidence.
