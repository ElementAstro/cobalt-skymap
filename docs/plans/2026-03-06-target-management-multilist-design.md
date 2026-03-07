# Multi-List Target Management Design

Date: 2026-03-06  
Scope: Complete target-management flow upgrade from single shot list to multi-list target management  
Priority: Product completeness (A) + Data-model correctness (A) + workflow continuity (A)  
Migration policy: No legacy single-list compatibility; replace persisted model with a new multi-list schema  
Acceptance standard: Automated tests for store, hooks, UI, TypeScript Tauri bindings, and Rust backend

## 1. Context and Goals

The current implementation provides a single persisted shot list with solid per-target actions, but the product docs and target-planning surface promise a larger target-management workflow:

1. Multiple target lists
2. List switching and list-level organization
3. Copy/move/merge operations between lists
4. Import/export with list context
5. Session planner input across multiple selected lists
6. Observation-log linkage back to planning sources

Today the end-to-end chain is split across:

1. `lib/stores/target-list-store.ts`
2. `components/starmap/planning/shot-list.tsx`
3. `components/starmap/planning/target-detail-dialog.tsx`
4. `lib/hooks/use-target-list-actions.ts`
5. Search/object/view add-entry points such as:
   - `components/starmap/search/stellarium-search.tsx`
   - `components/starmap/search/advanced-search-dialog.tsx`
   - `components/starmap/view/use-stellarium-view-state.ts`
   - `components/starmap/view/canvas-context-menu.tsx`
   - `components/starmap/objects/object-detail-drawer.tsx`
6. Tauri bindings in `lib/tauri/target-list-api.ts`
7. Rust persistence and IO in:
   - `src-tauri/src/data/targets.rs`
   - `src-tauri/src/data/target_io.rs`
8. Planner/log surfaces in:
   - `components/starmap/planning/session-planner.tsx`
   - `components/starmap/planning/observation-log.tsx`

Primary goals:

1. Replace the single-list model with a multi-list model that matches product intent.
2. Ensure the same celestial object can exist independently in multiple lists.
3. Support cross-list aggregation for session planning and observation logs.
4. Keep day-to-day usage centered on one active list, while exposing aggregation only where needed.
5. Upgrade the Tauri + Zustand persistence contract so the same model exists on both sides.

## 2. Approaches and Decision

### Approach A: Lists own embedded target copies

- Store shape: `lists[]`, each list embeds `targets[]`.
- Best for fast UI adaptation.
- Weak for cross-list aggregation, move/copy/merge semantics, and global selectors.

### Approach B (Chosen): List metadata + target-entry instances

- Store shape separates `targetLists[]` and `targetEntries[]`.
- Each entry belongs to exactly one list through `listId`.
- Per-entry status, priority, notes, tags, exposure plan, favorite/archive state stay fully independent.

Trade-off:

- Pros: clean multi-list semantics, simple aggregation, future-proof move/copy/merge flows, easy planner source filtering.
- Cons: larger refactor touching store, UI, bindings, and Rust storage together.

### Approach C: Global object table + association table

- Separate global “celestial object” identity from list membership.
- Most normalized model, but adds unnecessary indirection for this feature.

Trade-off:

- Pros: less duplicated static object metadata.
- Cons: over-designed for current workflow; user explicitly wants per-list independence, which reduces the value of a shared global object table.

Decision: Use Approach B.

## 3. Core Architecture

### 3.1 Data entities

#### `TargetList`

Each list represents an organizational container and view context, not an observation state holder.

Suggested fields:

- `id`
- `name`
- `description`
- `color`
- `defaultSortBy`
- `defaultSortOrder`
- `createdAt`
- `updatedAt`
- `isArchived`

#### `TargetEntry`

Each target entry is the list-scoped instance of a target. This is the unit that owns target-management state.

Suggested fields:

- `id`
- `listId`
- `name`
- `ra`
- `dec`
- `raString`
- `decString`
- `sensorWidth`
- `sensorHeight`
- `focalLength`
- `rotationAngle`
- `mosaic`
- `exposurePlan`
- `notes`
- `addedAt`
- `priority`
- `status`
- `tags`
- `observableWindow`
- `isFavorite`
- `isArchived`

#### `PlannerSelection`

The planner must not assume a single active list.

Suggested fields:

- `mode: 'active' | 'selected' | 'all_open'`
- `selectedListIds: string[]`

### 3.2 Store boundaries

`lib/stores/target-list-store.ts` remains the central target-management domain store, but its responsibilities change:

1. List CRUD
2. Entry CRUD
3. Active list selection
4. Per-list filtering/sorting/grouping
5. Cross-list aggregation for planning
6. Batch move/copy/merge operations
7. Tauri sync

Renames and replacements:

- `targets` → `entries`
- `activeTargetId` → `activeEntryId`
- `selectedIds` remains entry-selection state
- `activeListId` is introduced
- `plannerSelection` is introduced

### 3.3 Persistence contract

The feature explicitly does **not** preserve the previous single-list schema.

To avoid schema drift and partial hydration bugs:

- Zustand storage key should move from `starmap-target-list` to a new multi-list key, e.g. `starmap-target-management-v2`
- Tauri persisted payload should use the same structure and naming conventions
- Old data is intentionally ignored rather than migrated

This choice keeps the refactor simpler and prevents mixed-schema edge cases during hydration.

## 4. System Invariants

1. Every `TargetEntry` belongs to exactly one `TargetList`.
2. A target entry’s observation state is never shared across lists.
3. Removing a list removes only entries owned by that list.
4. Planner aggregation reads from selected lists, not from arbitrary global target state.
5. Day-to-day editing defaults to the active list.
6. Cross-list workflows must always preserve `listId` and `entryId` provenance.

## 5. UI and Interaction Design

### 5.1 Target-management panel

`components/starmap/planning/shot-list.tsx` remains the main entry point, but becomes a multi-list target-management panel.

Top area:

- active list switcher
- create list
- rename list
- archive/delete list
- list settings
- planner source shortcut

Main content:

- default view: active-list entries only
- optional aggregate view: entries from planner-selected lists, grouped by source list

### 5.2 List-level operations

Required list actions:

1. Create list
2. Rename list
3. Archive list
4. Delete list
5. Duplicate list
6. Merge multiple lists into:
   - a new list, or
   - an existing destination list

Deletion behavior:

- deleting the active list automatically selects the nearest remaining list
- if no lists remain, create a new empty default list

### 5.3 Entry-level operations

Existing target-entry controls remain:

- status change
- priority change
- favorite/archive toggle
- notes/edit detail
- navigate to target
- reorder within a list when manual sort is active

New entry controls:

- copy to another list
- move to another list
- show source list badge in aggregate views

`components/starmap/planning/target-detail-dialog.tsx` should expose list context as read-only and support list-aware actions where appropriate.

### 5.4 Planner/log source selection

`components/starmap/planning/session-planner.tsx` needs a visible “plan source lists” selector with:

- current active list
- explicit multi-select list set
- all non-archived lists

`components/starmap/planning/observation-log.tsx` must preserve source provenance from planner drafts:

- `entryId`
- `listId`
- `listName` snapshot

## 6. End-to-End Data Flows

### 6.1 Add target from search, map, object detail

All “add to target list” entry points should follow one contract:

1. Default destination is `activeListId`
2. Caller may override destination list explicitly
3. Batch add must support a target list destination

Affected add-entry surfaces:

- `components/starmap/search/stellarium-search.tsx`
- `components/starmap/search/advanced-search-dialog.tsx`
- `components/starmap/view/use-stellarium-view-state.ts`
- `components/starmap/view/canvas-context-menu.tsx`
- `components/starmap/objects/object-detail-drawer.tsx`
- `components/starmap/search/search-result-item.tsx`

`lib/hooks/use-target-list-actions.ts` becomes the shared destination-aware entry adapter.

### 6.2 Import/export flow

Import:

- user chooses destination list or creates a new list inline
- imported entries become new `TargetEntry` records for that list
- import result reports `imported`, `skipped`, `errors`, and the destination list context

Export:

- export current list or selected lists
- multi-list exports include a `list_name` field in the exported payload

### 6.3 Planner flow

Planner flow becomes:

1. resolve source list IDs from `plannerSelection`
2. flatten matching entries
3. carry `entryId` + `listId` into the generated planner draft
4. surface possible duplicate targets without merging them automatically

### 6.4 Observation log flow

Logs created from planner drafts must store:

- entry source identity
- list source identity
- object snapshot data

This keeps logs meaningful even after a list or entry is deleted later.

### 6.5 Tauri sync flow

`syncWithTauri` must load the full multi-list payload:

- `target_lists`
- `target_entries`
- `active_list_id`
- `active_entry_id`
- `planner_selection`

Store hydration should treat this payload as the single source of truth in desktop mode.

## 7. Duplicate Handling Policy

### 7.1 Within one list

- warn on duplicates
- allow user override
- duplicate heuristic stays “name + approximate coordinates”

### 7.2 Across different lists

- duplicates are allowed without warning during normal add flow
- aggregate planner views mark “possible duplicate” entries for user review

### 7.3 Merge behavior

Merge does not auto-deduplicate entries.

User choice during merge:

1. keep all
2. skip suspected duplicates
3. import non-duplicates only

## 8. Error Handling

1. Invalid or duplicate list name: block save and show inline validation
2. Missing active list after deletion: auto-fallback or auto-create default list
3. Planner with no selected lists: disable generation and show empty-state guidance
4. Empty aggregate result: show empty state, not error
5. Tauri sync failure: log and retain current in-memory state
6. Batch move/copy failures: partial success with summary toast and error logging

## 9. Testing Strategy

### 9.1 Store

Expand `lib/stores/__tests__/target-list-store.test.ts` to cover:

- list CRUD
- active list fallback
- list archive/delete
- entry copy/move across lists
- merge behavior
- planner selection and aggregate selectors

### 9.2 Hooks

Expand `lib/hooks/__tests__/use-target-list-actions.test.ts` to cover:

- add to active list
- add to explicit list
- batch add to explicit list

### 9.3 UI

Add/expand tests for:

- `components/starmap/planning/__tests__/shot-list.test.tsx`
- `components/starmap/planning/__tests__/target-detail-dialog.test.tsx`
- `components/starmap/planning/__tests__/session-planner.test.tsx`
- `components/starmap/planning/__tests__/observation-log.test.tsx`

### 9.4 Tauri TS bindings

Expand:

- `lib/tauri/__tests__/target-list-api.test.ts`
- `lib/tauri/__tests__/hooks.test.ts`

### 9.5 Rust backend

Expand:

- `src-tauri/src/data/targets.rs`
- `src-tauri/src/data/target_io.rs`

## 10. Non-Goals

This design intentionally does not include:

1. migration of legacy single-list data
2. a shared canonical celestial-object database
3. collaborative sync or cloud sync
4. automatic cross-list deduplication

## 11. Final Decision Summary

This feature should ship as a direct model replacement:

- one active list for daily operations
- many independent lists for organization
- fully independent per-list target instances
- explicit cross-list aggregation only where planning/logging needs it
- one consistent multi-list schema across Zustand, TypeScript bindings, and Rust persistence
