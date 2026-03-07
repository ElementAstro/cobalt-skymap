# Daily Knowledge Hybrid Reader Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a hybrid reading experience for Daily Knowledge with desktop-first pager mode, mobile-first feed mode, and optional wheel paging on desktop.

**Architecture:** Keep `getDailyKnowledge` and existing content/state flows unchanged. Extend `useDailyKnowledgeStore` with persisted UI preferences (`viewMode`, `wheelPagingEnabled`) and render two UI modes (`pager` and `feed`) inside `DailyKnowledgeDialog`. Reuse current actions (`next`, `prev`, `random`, `setCurrentItemById`) to avoid duplicate navigation logic.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, Jest + RTL, Playwright, next-intl.

---

**Execution notes**
- Apply @superpowers:test-driven-development on every task.
- Run @superpowers:verification-before-completion before final merge.
- Keep commits small and task-scoped (one task = one commit).

### Task 1: Persist Reader UI Preferences In Store

**Files:**
- Modify: `lib/stores/__tests__/daily-knowledge-store.test.ts`
- Modify: `lib/stores/daily-knowledge-store.ts`

**Step 1: Write the failing test**

```ts
it('persists reader UI preferences', () => {
  const store = useDailyKnowledgeStore.getState();
  expect(store.viewMode).toBe('pager');
  expect(store.wheelPagingEnabled).toBe(false);

  store.setViewMode('feed');
  store.setWheelPagingEnabled(true);

  const next = useDailyKnowledgeStore.getState();
  expect(next.viewMode).toBe('feed');
  expect(next.wheelPagingEnabled).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand lib/stores/__tests__/daily-knowledge-store.test.ts`  
Expected: FAIL with missing `viewMode` / `setViewMode` / `wheelPagingEnabled`.

**Step 3: Write minimal implementation**

```ts
type DailyKnowledgeViewMode = 'pager' | 'feed';

interface DailyKnowledgeState extends DailyKnowledgePersistedState {
  viewMode: DailyKnowledgeViewMode;
  wheelPagingEnabled: boolean;
  setViewMode: (mode: DailyKnowledgeViewMode) => void;
  setWheelPagingEnabled: (enabled: boolean) => void;
}

// initial state
viewMode: 'pager',
wheelPagingEnabled: false,
setViewMode: (viewMode) => set({ viewMode }),
setWheelPagingEnabled: (wheelPagingEnabled) => set({ wheelPagingEnabled }),

// partialize persistence
viewMode: state.viewMode,
wheelPagingEnabled: state.wheelPagingEnabled,
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand lib/stores/__tests__/daily-knowledge-store.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/stores/daily-knowledge-store.ts lib/stores/__tests__/daily-knowledge-store.test.ts
git commit -m "feat(daily-knowledge): persist reader ui preferences"
```

### Task 2: Add Mode Controls And Device Defaults

**Files:**
- Modify: `components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx`
- Modify: `components/starmap/knowledge/daily-knowledge-dialog.tsx`
- Modify: `i18n/messages/en.json`
- Modify: `i18n/messages/zh.json`

**Step 1: Write the failing test**

```tsx
it('defaults to pager on desktop and feed on mobile', () => {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 Windows NT 10.0' });
  render(<DailyKnowledgeDialog />);
  expect(screen.getByRole('tab', { name: 'dailyKnowledge.viewModePager' })).toHaveAttribute('aria-selected', 'true');
});

it('switches to feed mode from toolbar toggle', () => {
  render(<DailyKnowledgeDialog />);
  fireEvent.click(screen.getByRole('tab', { name: 'dailyKnowledge.viewModeFeed' }));
  expect(mockStore.setViewMode).toHaveBeenCalledWith('feed');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx`  
Expected: FAIL with missing tabs and missing `setViewMode`.

**Step 3: Write minimal implementation**

```tsx
import { isMobile } from '@/lib/storage/platform';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

useEffect(() => {
  if (viewMode !== 'pager' && viewMode !== 'feed') {
    setViewMode(isMobile() ? 'feed' : 'pager');
  }
}, [setViewMode, viewMode]);

<Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'pager' | 'feed')}>
  <TabsList>
    <TabsTrigger value="pager">{t('dailyKnowledge.viewModePager')}</TabsTrigger>
    <TabsTrigger value="feed">{t('dailyKnowledge.viewModeFeed')}</TabsTrigger>
  </TabsList>
</Tabs>
```

```json
"viewModePager": "Pager",
"viewModeFeed": "Feed",
"wheelPaging": "Wheel paging"
```

```json
"viewModePager": "翻页",
"viewModeFeed": "列表流",
"wheelPaging": "滚轮翻页"
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add components/starmap/knowledge/daily-knowledge-dialog.tsx components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx i18n/messages/en.json i18n/messages/zh.json
git commit -m "feat(daily-knowledge): add pager feed mode controls"
```

### Task 3: Add Pager Keyboard Navigation

**Files:**
- Modify: `components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx`
- Modify: `components/starmap/knowledge/daily-knowledge-dialog.tsx`

**Step 1: Write the failing test**

```tsx
it('handles ArrowLeft/ArrowRight in pager mode', () => {
  mockStore.viewMode = 'pager';
  render(<DailyKnowledgeDialog />);
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(mockStore.prev).toHaveBeenCalledTimes(1);
  expect(mockStore.next).toHaveBeenCalledTimes(1);
});

it('does not bind keyboard handler in feed mode', () => {
  mockStore.viewMode = 'feed';
  render(<DailyKnowledgeDialog />);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(mockStore.next).not.toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx -t "ArrowLeft|ArrowRight"`  
Expected: FAIL with no keyboard handler.

**Step 3: Write minimal implementation**

```tsx
useEffect(() => {
  if (!open || viewMode !== 'pager') return;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') prev();
    if (event.key === 'ArrowRight') next();
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, [open, viewMode, prev, next]);
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx -t "ArrowLeft|ArrowRight"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add components/starmap/knowledge/daily-knowledge-dialog.tsx components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx
git commit -m "feat(daily-knowledge): add keyboard pager navigation"
```

### Task 4: Add Optional Desktop Wheel Paging With Throttle

**Files:**
- Modify: `components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx`
- Modify: `components/starmap/knowledge/daily-knowledge-dialog.tsx`

**Step 1: Write the failing test**

```tsx
it('does not page on wheel when toggle is disabled', () => {
  mockStore.viewMode = 'pager';
  mockStore.wheelPagingEnabled = false;
  render(<DailyKnowledgeDialog />);
  fireEvent.wheel(window, { deltaY: 100 });
  expect(mockStore.next).not.toHaveBeenCalled();
});

it('pages once per throttle window when wheel paging is enabled', () => {
  jest.useFakeTimers();
  mockStore.viewMode = 'pager';
  mockStore.wheelPagingEnabled = true;
  render(<DailyKnowledgeDialog />);
  fireEvent.wheel(window, { deltaY: 120 });
  fireEvent.wheel(window, { deltaY: 120 });
  expect(mockStore.next).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(320);
  fireEvent.wheel(window, { deltaY: 120 });
  expect(mockStore.next).toHaveBeenCalledTimes(2);
  jest.useRealTimers();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx -t "wheel"`  
Expected: FAIL with missing wheel behavior.

**Step 3: Write minimal implementation**

```tsx
const lastWheelAtRef = useRef(0);
const WHEEL_THROTTLE_MS = 300;

useEffect(() => {
  if (!open || viewMode !== 'pager' || !wheelPagingEnabled || isMobile()) return;
  const onWheel = (event: WheelEvent) => {
    const now = Date.now();
    if (now - lastWheelAtRef.current < WHEEL_THROTTLE_MS) return;
    lastWheelAtRef.current = now;
    if (event.deltaY > 0) next();
    if (event.deltaY < 0) prev();
  };
  window.addEventListener('wheel', onWheel, { passive: true });
  return () => window.removeEventListener('wheel', onWheel);
}, [open, viewMode, wheelPagingEnabled, next, prev]);
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx -t "wheel"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add components/starmap/knowledge/daily-knowledge-dialog.tsx components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx
git commit -m "feat(daily-knowledge): add optional wheel paging with throttle"
```

### Task 5: Implement Feed Rendering And Item Selection Sync

**Files:**
- Modify: `components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx`
- Modify: `components/starmap/knowledge/daily-knowledge-dialog.tsx`

**Step 1: Write the failing test**

```tsx
it('renders feed cards and sets current item on card click', () => {
  mockStore.viewMode = 'feed';
  render(<DailyKnowledgeDialog />);
  fireEvent.click(screen.getByRole('button', { name: /Item B/ }));
  expect(mockStore.setCurrentItemById).toHaveBeenCalledWith('item-b');
});

it('keeps filters unchanged when switching between pager and feed', () => {
  mockStore.filters = { query: 'm31', category: 'all', source: 'all', favoritesOnly: false };
  render(<DailyKnowledgeDialog />);
  fireEvent.click(screen.getByRole('tab', { name: 'dailyKnowledge.viewModeFeed' }));
  expect(mockStore.setFilters).not.toHaveBeenCalledWith({ query: '' });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx -t "feed"`  
Expected: FAIL with no feed cards / no click target.

**Step 3: Write minimal implementation**

```tsx
{viewMode === 'feed' ? (
  <ScrollArea className="h-[28rem] pr-2">
    <div className="space-y-3">
      {filteredItems.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <button type="button" onClick={() => setCurrentItemById(item.id)} className="text-left font-semibold">
              {item.title}
            </button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{item.summary}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  </ScrollArea>
) : (
  /* existing focused detail layout */
)}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx -t "feed"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add components/starmap/knowledge/daily-knowledge-dialog.tsx components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx
git commit -m "feat(daily-knowledge): add feed reading mode with item sync"
```

### Task 6: Add E2E Coverage For Desktop/Mobile Defaults

**Files:**
- Modify: `tests/e2e/starmap/daily-knowledge.spec.ts`

**Step 1: Write the failing test**

```ts
test('desktop opens in pager mode by default', async ({ page }) => {
  await seedStarmapState(page, { enabled: true, autoShow: false, onlineEnhancement: false });
  await openReadyStarmap(page);
  await page.locator('[data-tour-id="daily-knowledge"] button').first().click();
  const dialog = page.locator('[role="dialog"]').filter({ hasText: /daily knowledge|每日知识/i });
  await expect(dialog.getByRole('tab', { name: /pager|翻页/i })).toHaveAttribute('data-state', 'active');
});

test('mobile opens in feed mode and card click updates current entry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedStarmapState(page, { enabled: true, autoShow: false, onlineEnhancement: false });
  await openReadyStarmap(page);
  await page.locator('[data-tour-id="daily-knowledge"] button').first().click();
  const dialog = page.locator('[role="dialog"]').filter({ hasText: /daily knowledge|每日知识/i });
  await expect(dialog.getByRole('tab', { name: /feed|列表流/i })).toHaveAttribute('data-state', 'active');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:e2e -- tests/e2e/starmap/daily-knowledge.spec.ts`  
Expected: FAIL because tabs/modes are not implemented yet.

**Step 3: Write minimal implementation adjustments**

```ts
// If selectors are unstable, add deterministic data-testid:
// data-testid="daily-knowledge-view-pager"
// data-testid="daily-knowledge-view-feed"
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:e2e -- tests/e2e/starmap/daily-knowledge.spec.ts`  
Expected: PASS in local CI-like environment.

**Step 5: Commit**

```bash
git add tests/e2e/starmap/daily-knowledge.spec.ts components/starmap/knowledge/daily-knowledge-dialog.tsx
git commit -m "test(e2e): cover daily knowledge hybrid reader defaults"
```

### Task 7: Final Verification Gate

**Files:**
- Verify only, no file changes expected.

**Step 1: Run focused unit tests**

Run: `pnpm test -- --runInBand lib/stores/__tests__/daily-knowledge-store.test.ts components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx`  
Expected: PASS.

**Step 2: Run E2E spec**

Run: `pnpm test:e2e -- tests/e2e/starmap/daily-knowledge.spec.ts`  
Expected: PASS.

**Step 3: Run lint and typecheck**

Run: `pnpm lint`  
Expected: PASS with no new warnings/errors.

Run: `pnpm exec tsc --noEmit`  
Expected: PASS.

**Step 4: Prepare integration commit**

```bash
git add components/starmap/knowledge/daily-knowledge-dialog.tsx lib/stores/daily-knowledge-store.ts i18n/messages/en.json i18n/messages/zh.json components/starmap/knowledge/__tests__/daily-knowledge-dialog.test.tsx lib/stores/__tests__/daily-knowledge-store.test.ts tests/e2e/starmap/daily-knowledge.spec.ts
git commit -m "feat(daily-knowledge): implement hybrid reader for desktop and mobile"
```

**Step 5: Capture validation summary**

```md
- Unit: PASS
- E2E: PASS
- Lint: PASS
- Typecheck: PASS
```
