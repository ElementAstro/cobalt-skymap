export type TargetSortBy = 'manual' | 'name' | 'priority' | 'status' | 'addedAt' | 'feasibility';
export type TargetSortOrder = 'asc' | 'desc';

export interface TargetListRecord {
  id: string;
  name: string;
  description?: string;
  color?: string;
  defaultSortBy?: TargetSortBy;
  defaultSortOrder?: TargetSortOrder;
  createdAt: number;
  updatedAt: number;
  isArchived: boolean;
}

export interface CreateTargetListInput {
  name: string;
  description?: string;
  color?: string;
  defaultSortBy?: TargetSortBy;
  defaultSortOrder?: TargetSortOrder;
}

export interface PlannerSelectionState {
  mode: 'active' | 'selected' | 'all_open';
  selectedListIds: string[];
}

export type MergeDuplicatePolicy = 'keep_all' | 'skip_duplicates' | 'only_non_duplicates';

export interface MergeTargetListsInput {
  sourceListIds: string[];
  destinationListId: string;
  duplicatePolicy?: MergeDuplicatePolicy;
}
