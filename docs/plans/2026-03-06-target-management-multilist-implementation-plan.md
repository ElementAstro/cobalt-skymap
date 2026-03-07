# Multi-List Target Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build multi-list target management with list-scoped target instances, cross-list planner selection, list-aware import/export, and observation-log provenance across the existing starmap planning workflow.

**Architecture:** Replace the current single `targets[]` model with a two-entity model: `targetLists[]` for list metadata and `targetEntries[]` for list-owned target instances. Keep `lib/stores/target-list-store.ts` as the target-management domain store, upgrade the TypeScript Tauri bindings and Rust storage to the same schema, and limit UI complexity by keeping most editing scoped to one active list while exposing cross-list aggregation only in planning/logging surfaces.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zustand, Jest + React Testing Library, Tauri 2.9, Rust, next-intl

---

### Task 1: Introduce shared multi-list target-management types

**Files:**
- Create: `types/starmap/target-management.ts`
- Modify: `types/starmap/index.ts`
- Modify: `lib/stores/__tests__/target-list-store.test.ts`

**Step 1: Write the failing test**

```ts
it('exposes multi-list target-management state', () => {
  const state = useTargetListStore.getState();
  expect(Array.isArray(state.targetLists)).toBe(true);
  expect(Array.isArray(state.targetEntries)).toBe(true);
  expect(typeof state.activeListId).toBe('string');
  expect(state.plannerSelection).toEqual({
    mode: 'active',
    selectedListIds: [],
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand lib/stores/__tests__/target-list-store.test.ts -t "exposes multi-list target-management state"`  
Expected: FAIL because the current store still exposes the single-list shape.

**Step 3: Write minimal implementation**

```ts
export interface TargetListRecord {
  id: string;
  name: string;
  description?: string;
  color?: string;
  defaultSortBy?: 'manual' | 'name' | 'priority' | 'status' | 'addedAt' | 'feasibility';
  defaultSortOrder?: 'asc' | 'desc';
  createdAt: number;
  updatedAt: number;
  isArchived: boolean;
}

export interface PlannerSelectionState {
  mode: 'active' | 'selected' | 'all_open';
  selectedListIds: string[];
}
```

Bootstrap `targetLists`, `targetEntries`, `activeListId`, and `plannerSelection` in `lib/stores/target-list-store.ts`.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand lib/stores/__tests__/target-list-store.test.ts -t "exposes multi-list target-management state"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add types/starmap/target-management.ts types/starmap/index.ts lib/stores/target-list-store.ts lib/stores/__tests__/target-list-store.test.ts
git commit -m "refactor(targets): add shared multi-list target management types"
```

### Task 2: Add list CRUD and active-list fallback behavior

**Files:**
- Modify: `lib/stores/target-list-store.ts`
- Modify: `lib/stores/__tests__/target-list-store.test.ts`

**Step 1: Write the failing test**

```ts
it('creates a default replacement list when the last list is deleted', () => {
  const store = useTargetListStore.getState();
  const listId = store.activeListId;
  store.deleteList(listId);

  const next = useTargetListStore.getState();
  expect(next.targetLists).toHaveLength(1);
  expect(next.activeListId).toBe(next.targetLists[0].id);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand lib/stores/__tests__/target-list-store.test.ts -t "creates a default replacement list when the last list is deleted"`  
Expected: FAIL because list CRUD does not exist yet.

**Step 3: Write minimal implementation**

```ts
createList({ name, description, color }) { ... }
renameList(listId, name) { ... }
archiveList(listId) { ... }
deleteList(listId) { ... }
setActiveList(listId) { ... }
```

Fallback rule:

```ts
if (remainingLists.length === 0) {
  const fallback = createDefaultList();
  return { targetLists: [fallback], activeListId: fallback.id };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand lib/stores/__tests__/target-list-store.test.ts -t "creates a default replacement list when the last list is deleted"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/stores/target-list-store.ts lib/stores/__tests__/target-list-store.test.ts
git commit -m "feat(targets): add multi-list CRUD and active-list fallback"
```

### Task 3: Convert entry CRUD to be list-scoped

**Files:**
- Modify: `lib/stores/target-list-store.ts`
- Modify: `lib/stores/__tests__/target-list-store.test.ts`
- Modify: `components/starmap/planning/target-detail-dialog.tsx`
- Modify: `components/starmap/planning/__tests__/target-detail-dialog.test.tsx`

**Step 1: Write the failing test**

```ts
it('keeps target state independent across lists', () => {
  const store = useTargetListStore.getState();
  const listA = store.activeListId;
  const listB = store.createList({ name: 'Widefield' });

  const a = store.addEntryToList(listA, baseEntry);
  const b = store.addEntryToList(listB, baseEntry);
  store.updateEntry(a.id, { status: 'completed', notes: 'done' });

  const next = useTargetListStore.getState();
  expect(next.getEntryById(a.id)?.status).toBe('completed');
  expect(next.getEntryById(b.id)?.status).toBe('planned');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand lib/stores/__tests__/target-list-store.test.ts -t "keeps target state independent across lists"`  
Expected: FAIL because entries are still modeled as a single global target list.

**Step 3: Write minimal implementation**

```ts
addEntryToList(listId, input) { ... }
updateEntry(entryId, updates) { ... }
removeEntry(entryId) { ... }
setActiveEntry(entryId | null) { ... }
```

Update the detail dialog to read/write `TargetEntry` data and show the owning list as read-only context.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- --runInBand lib/stores/__tests__/target-list-store.test.ts -t "keeps target state independent across lists"
pnpm test -- --runInBand components/starmap/planning/__tests__/target-detail-dialog.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/stores/target-list-store.ts lib/stores/__tests__/target-list-store.test.ts components/starmap/planning/target-detail-dialog.tsx components/starmap/planning/__tests__/target-detail-dialog.test.tsx
git commit -m "refactor(targets): scope target entries to owning lists"
```

### Task 4: Add copy, move, merge, and aggregate selectors

**Files:**
- Modify: `lib/stores/target-list-store.ts`
- Modify: `lib/stores/__tests__/target-list-store.test.ts`

**Step 1: Write the failing test**

```ts
it('aggregates entries across selected planner lists', () => {
  const store = useTargetListStore.getState();
  const wide = store.createList({ name: 'Wide' });
  const narrow = store.createList({ name: 'Narrow' });
  store.addEntryToList(wide, { ...m31 });
  store.addEntryToList(narrow, { ...ngc7000 });
  store.setPlannerSelection({ mode: 'selected', selectedListIds: [wide, narrow] });

  expect(store.getPlannerEntries()).toHaveLength(2);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand lib/stores/__tests__/target-list-store.test.ts -t "aggregates entries across selected planner lists"`  
Expected: FAIL because planner selection and aggregation selectors do not exist.

**Step 3: Write minimal implementation**

```ts
copyEntriesToList(entryIds, destinationListId) { ... }
moveEntriesToList(entryIds, destinationListId) { ... }
mergeLists({ sourceListIds, destinationListId, duplicatePolicy }) { ... }
setPlannerSelection(selection) { ... }
getPlannerEntries() { ... }
getEntriesForList(listId) { ... }
getAggregateEntries(listIds) { ... }
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand lib/stores/__tests__/target-list-store.test.ts -t "aggregates entries across selected planner lists"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/stores/target-list-store.ts lib/stores/__tests__/target-list-store.test.ts
git commit -m "feat(targets): add list copy move merge and planner aggregation selectors"
```

### Task 5: Upgrade persisted Zustand and Tauri sync contract

**Files:**
- Modify: `lib/stores/target-list-store.ts`
- Modify: `lib/tauri/TauriSyncProvider.tsx`
- Modify: `lib/tauri/__tests__/hooks.test.ts`
- Modify: `lib/storage/types.ts`
- Modify: `lib/storage/zustand-storage.ts`

**Step 1: Write the failing test**

```ts
it('hydrates multi-list target data from Tauri', async () => {
  mockTargetListApi.load.mockResolvedValue({
    target_lists: [{ id: 'l1', name: 'Tonight', created_at: 1, updated_at: 1, is_archived: false }],
    target_entries: [{ id: 'e1', list_id: 'l1', name: 'M31', ra: 10.6, dec: 41.2, added_at: 1, priority: 'medium', status: 'planned', tags: [], is_favorite: false, is_archived: false }],
    active_list_id: 'l1',
    active_entry_id: null,
    planner_selection: { mode: 'active', selected_list_ids: [] },
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand lib/tauri/__tests__/hooks.test.ts -t "hydrates multi-list target data from Tauri"`  
Expected: FAIL because `syncWithTauri` still expects the single-list payload.

**Step 3: Write minimal implementation**

```ts
name: 'starmap-target-management-v2',
partialize: (state) => ({
  targetLists: state.targetLists,
  targetEntries: state.targetEntries,
  activeListId: state.activeListId,
  activeEntryId: state.activeEntryId,
  plannerSelection: state.plannerSelection,
})
```

Map Tauri snake_case payloads into the new store shape during `syncWithTauri`.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand lib/tauri/__tests__/hooks.test.ts -t "hydrates multi-list target data from Tauri"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/stores/target-list-store.ts lib/tauri/TauriSyncProvider.tsx lib/tauri/__tests__/hooks.test.ts lib/storage/types.ts lib/storage/zustand-storage.ts
git commit -m "refactor(targets): persist and hydrate multi-list target schema"
```

### Task 6: Upgrade TypeScript Tauri target APIs and types

**Files:**
- Modify: `lib/tauri/types.ts`
- Modify: `lib/tauri/target-list-api.ts`
- Modify: `lib/tauri/__tests__/target-list-api.test.ts`

**Step 1: Write the failing test**

```ts
it('creates a target list through Tauri', async () => {
  await targetListApi.createList({ name: 'Tonight' });
  expect(mockInvoke).toHaveBeenCalledWith('create_target_list', {
    input: { name: 'Tonight' },
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand lib/tauri/__tests__/target-list-api.test.ts -t "creates a target list through Tauri"`  
Expected: FAIL because list commands do not exist in the TypeScript binding.

**Step 3: Write minimal implementation**

```ts
export interface TargetListDataV2 {
  target_lists: TargetListRecordApi[];
  target_entries: TargetEntryApi[];
  active_list_id: string | null;
  active_entry_id: string | null;
  planner_selection: PlannerSelectionApi;
}

createList(input) { return invoke('create_target_list', { input }); }
addEntryToList(listId, entry) { return invoke('add_target_entry', { listId, entry }); }
moveEntries(entryIds, destinationListId) { ... }
mergeLists(input) { ... }
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand lib/tauri/__tests__/target-list-api.test.ts -t "creates a target list through Tauri"`  
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/tauri/types.ts lib/tauri/target-list-api.ts lib/tauri/__tests__/target-list-api.test.ts
git commit -m "feat(tauri): add multi-list target-management API bindings"
```

### Task 7: Upgrade Rust target storage commands to the multi-list model

**Files:**
- Modify: `src-tauri/src/data/targets.rs`
- Modify: `src-tauri/src/data/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Write the failing test**

```rust
#[test]
fn test_create_target_list_and_add_entry() {
    let data = TargetManagementData::default();
    // create list, add entry, assert list_id ownership and active_list_id
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test test_create_target_list_and_add_entry -- --nocapture`  
Expected: FAIL because Rust storage only understands the single-list payload.

**Step 3: Write minimal implementation**

```rust
pub struct TargetManagementData {
    pub target_lists: Vec<TargetListRecord>,
    pub target_entries: Vec<TargetEntry>,
    pub active_list_id: Option<String>,
    pub active_entry_id: Option<String>,
    pub planner_selection: PlannerSelection,
}
```

Add command handlers such as:

```rust
create_target_list
update_target_list
delete_target_list
add_target_entry
update_target_entry
remove_target_entry
move_target_entries
copy_target_entries
merge_target_lists
set_active_target_list
set_planner_selection
```

**Step 4: Run test to verify it passes**

Run: `cargo test test_create_target_list_and_add_entry -- --nocapture`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src-tauri/src/data/targets.rs src-tauri/src/data/mod.rs src-tauri/src/lib.rs
git commit -m "refactor(tauri): replace single target list storage with multi-list model"
```

### Task 8: Make import/export list-aware in Rust and TypeScript

**Files:**
- Modify: `src-tauri/src/data/target_io.rs`
- Modify: `src-tauri/src/data/targets.rs`
- Modify: `lib/tauri/types.ts`
- Modify: `components/starmap/planning/shot-list.tsx`
- Modify: `components/starmap/planning/__tests__/shot-list.test.tsx`

**Step 1: Write the failing test**

```tsx
it('exports multiple selected lists with source list names', async () => {
  render(<ShotList {...defaultProps} />);
  // choose aggregate export and assert tauri call receives list_name values
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/starmap/planning/__tests__/shot-list.test.tsx -t "exports multiple selected lists with source list names"`  
Expected: FAIL because export/import still assume a flat target array.

**Step 3: Write minimal implementation**

```ts
export interface TargetExportItem {
  list_name?: string;
  name: string;
  ra: number;
  dec: number;
}
```

Rust import/export should accept destination list selection and preserve list names for multi-list exports.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- --runInBand components/starmap/planning/__tests__/shot-list.test.tsx -t "exports multiple selected lists with source list names"
cargo test test_export_targets_with_list_name -- --nocapture
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src-tauri/src/data/target_io.rs src-tauri/src/data/targets.rs lib/tauri/types.ts components/starmap/planning/shot-list.tsx components/starmap/planning/__tests__/shot-list.test.tsx
git commit -m "feat(target-io): add list-aware import export for multi-list targets"
```

### Task 9: Update add-to-target entry points and shared hooks

**Files:**
- Modify: `lib/hooks/use-target-list-actions.ts`
- Modify: `lib/hooks/__tests__/use-target-list-actions.test.ts`
- Modify: `components/starmap/search/stellarium-search.tsx`
- Modify: `components/starmap/search/advanced-search-dialog.tsx`
- Modify: `components/starmap/view/use-stellarium-view-state.ts`
- Modify: `components/starmap/view/canvas-context-menu.tsx`
- Modify: `components/starmap/objects/object-detail-drawer.tsx`
- Modify: `components/starmap/search/search-result-item.tsx`

**Step 1: Write the failing test**

```ts
it('adds targets to the provided destination list', () => {
  const { result } = renderHook(() =>
    useTargetListActions({ targetListId: 'list-2' })
  );
  act(() => result.current.handleAddToTargetList(item));
  expect(useTargetListStore.getState().getEntriesForList('list-2')).toHaveLength(1);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand lib/hooks/__tests__/use-target-list-actions.test.ts -t "adds targets to the provided destination list"`  
Expected: FAIL because the hook still assumes one implicit global list.

**Step 3: Write minimal implementation**

```ts
export function useTargetListActions(options?: {
  targetListId?: string;
  getSelectedItems?: () => SearchResultItem[];
}) {
  const activeListId = useTargetListStore((state) => state.activeListId);
  const addEntryToList = useTargetListStore((state) => state.addEntryToList);
  const destinationListId = options?.targetListId ?? activeListId;
}
```

Thread destination selection through all add-target surfaces.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- --runInBand lib/hooks/__tests__/use-target-list-actions.test.ts
pnpm test -- --runInBand components/starmap/search/__tests__/stellarium-search.test.tsx
pnpm test -- --runInBand components/starmap/search/__tests__/advanced-search-dialog.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/hooks/use-target-list-actions.ts lib/hooks/__tests__/use-target-list-actions.test.ts components/starmap/search/stellarium-search.tsx components/starmap/search/advanced-search-dialog.tsx components/starmap/view/use-stellarium-view-state.ts components/starmap/view/canvas-context-menu.tsx components/starmap/objects/object-detail-drawer.tsx components/starmap/search/search-result-item.tsx
git commit -m "feat(targets): route add-to-list actions through active or chosen target lists"
```

### Task 10: Rebuild the shot-list UI into a multi-list target-management panel

**Files:**
- Modify: `components/starmap/planning/shot-list.tsx`
- Modify: `components/starmap/planning/__tests__/shot-list.test.tsx`
- Modify: `types/starmap/planning.ts`

**Step 1: Write the failing test**

```tsx
it('switches between target lists and renders only active-list entries', () => {
  render(<ShotList {...defaultProps} />);
  // choose list B, expect list A entries hidden and list B entries shown
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/starmap/planning/__tests__/shot-list.test.tsx -t "switches between target lists and renders only active-list entries"`  
Expected: FAIL because the panel still renders a single global list.

**Step 3: Write minimal implementation**

```tsx
<Select value={activeListId} onValueChange={setActiveList}>
  {targetLists.map((list) => (
    <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>
  ))}
</Select>
```

Expose:

- create/rename/archive/delete list actions
- copy/move selected entries
- aggregate view toggle with source-list badges

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand components/starmap/planning/__tests__/shot-list.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add components/starmap/planning/shot-list.tsx components/starmap/planning/__tests__/shot-list.test.tsx types/starmap/planning.ts
git commit -m "feat(planning): turn shot list into multi-list target management panel"
```

### Task 11: Add multi-list source selection to the session planner

**Files:**
- Modify: `components/starmap/planning/session-planner.tsx`
- Modify: `components/starmap/planning/__tests__/session-planner.test.tsx`
- Modify: `lib/stores/session-plan-store.ts`
- Modify: `types/starmap/session-planner-v2.ts`

**Step 1: Write the failing test**

```tsx
it('generates a plan from selected target lists', async () => {
  render(<SessionPlanner />);
  // select two lists, generate plan, assert entries from both lists are used
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/starmap/planning/__tests__/session-planner.test.tsx -t "generates a plan from selected target lists"`  
Expected: FAIL because the planner still assumes one current shot list.

**Step 3: Write minimal implementation**

```ts
const plannerEntries = useTargetListStore((state) => state.getPlannerEntries());
const plannerSelection = useTargetListStore((state) => state.plannerSelection);
```

Add planner source UI and carry `entryId` / `listId` into generated draft items.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand components/starmap/planning/__tests__/session-planner.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add components/starmap/planning/session-planner.tsx components/starmap/planning/__tests__/session-planner.test.tsx lib/stores/session-plan-store.ts types/starmap/session-planner-v2.ts
git commit -m "feat(planner): support multi-list target aggregation for session planning"
```

### Task 12: Preserve list provenance in observation-log drafts and records

**Files:**
- Modify: `components/starmap/planning/observation-log.tsx`
- Modify: `components/starmap/planning/__tests__/observation-log.test.tsx`
- Modify: `types/starmap/session-planner-v2.ts`

**Step 1: Write the failing test**

```tsx
it('creates planner drafts with source list metadata', () => {
  render(<ObservationLog />);
  // trigger create planner draft
  // expect listId and listName snapshot to be present in saved draft
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/starmap/planning/__tests__/observation-log.test.tsx -t "creates planner drafts with source list metadata"`  
Expected: FAIL because drafts do not yet preserve list-level source context.

**Step 3: Write minimal implementation**

```ts
{
  entryId,
  listId,
  listName,
  targetName,
  ra,
  dec,
}
```

Ensure log creation and planner-draft shortcuts preserve these fields even if the source list changes later.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --runInBand components/starmap/planning/__tests__/observation-log.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add components/starmap/planning/observation-log.tsx components/starmap/planning/__tests__/observation-log.test.tsx types/starmap/session-planner-v2.ts
git commit -m "feat(observation-log): keep multi-list target provenance in planner drafts"
```

### Task 13: Update i18n, user docs, and regression gates

**Files:**
- Modify: `i18n/messages/en.json`
- Modify: `i18n/messages/zh.json`
- Modify: `docs/user-guide/observation-planning/target-lists.md`
- Modify: `docs/reference/faq.md`

**Step 1: Write the failing test**

```tsx
it('renders target list management controls', () => {
  render(<ShotList {...defaultProps} />);
  expect(screen.getByText(/createList/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --runInBand components/starmap/planning/__tests__/shot-list.test.tsx -t "renders target list management controls"`  
Expected: FAIL until new copy and controls exist.

**Step 3: Write minimal implementation**

Add translations and update the docs to explain:

- multiple target lists
- copy/move/merge behavior
- planner source selection
- list-aware import/export

**Step 4: Run verification gates**

Run:

```bash
pnpm test -- --runInBand lib/stores/__tests__/target-list-store.test.ts
pnpm test -- --runInBand lib/hooks/__tests__/use-target-list-actions.test.ts
pnpm test -- --runInBand components/starmap/planning/__tests__/shot-list.test.tsx
pnpm test -- --runInBand components/starmap/planning/__tests__/target-detail-dialog.test.tsx
pnpm test -- --runInBand components/starmap/planning/__tests__/session-planner.test.tsx
pnpm test -- --runInBand components/starmap/planning/__tests__/observation-log.test.tsx
pnpm test -- --runInBand lib/tauri/__tests__/target-list-api.test.ts
pnpm lint
pnpm exec tsc --noEmit
cargo test test_create_target_list_and_add_entry -- --nocapture
cargo test test_export_targets_with_list_name -- --nocapture
```

Expected: all targeted tests PASS, lint passes, typecheck passes, Rust tests pass.

**Step 5: Commit**

```bash
git add i18n/messages/en.json i18n/messages/zh.json docs/user-guide/observation-planning/target-lists.md docs/reference/faq.md lib/stores/__tests__/target-list-store.test.ts lib/hooks/__tests__/use-target-list-actions.test.ts components/starmap/planning/__tests__/shot-list.test.tsx components/starmap/planning/__tests__/target-detail-dialog.test.tsx components/starmap/planning/__tests__/session-planner.test.tsx components/starmap/planning/__tests__/observation-log.test.tsx lib/tauri/__tests__/target-list-api.test.ts
git commit -m "docs(targets): document and verify multi-list target management flow"
```
