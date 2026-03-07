'use client';

import { useCallback } from 'react';
import { useTargetListStore } from '@/lib/stores/target-list-store';
import { degreesToHMS, degreesToDMS } from '@/lib/astronomy/starmap-utils';
import type { SearchResultItem } from '@/lib/core/types';

/**
 * Shared hook for target list actions (add single / batch add).
 * Used by StellariumSearch and AdvancedSearchDialog to avoid duplicated logic.
 */
export function useTargetListActions(options?: {
  targetListId?: string;
  getSelectedItems?: () => SearchResultItem[];
  clearSelection?: () => void;
  onBatchAdd?: (items: SearchResultItem[]) => void;
}) {
  const activeListId = useTargetListStore((state) => state.activeListId);
  const addEntryToList = useTargetListStore((state) => state.addEntryToList);
  const addTargetsBatch = useTargetListStore((state) => state.addTargetsBatch);
  const destinationListId = options?.targetListId ?? activeListId;

  const handleAddToTargetList = useCallback((item: SearchResultItem) => {
    if (item.RA !== undefined && item.Dec !== undefined && destinationListId) {
      addEntryToList(destinationListId, {
        name: item.Name,
        ra: item.RA,
        dec: item.Dec,
        raString: degreesToHMS(item.RA),
        decString: degreesToDMS(item.Dec),
        priority: 'medium',
      });
    }
  }, [addEntryToList, destinationListId]);

  const handleBatchAdd = useCallback(() => {
    const selected = options?.getSelectedItems?.() ?? [];
    if (selected.length === 0) return;

    const batchItems = selected
      .filter(item => item.RA !== undefined && item.Dec !== undefined)
      .map(item => ({
        name: item.Name,
        ra: item.RA!,
        dec: item.Dec!,
        raString: degreesToHMS(item.RA!),
        decString: degreesToDMS(item.Dec!),
      }));

      if (batchItems.length > 0 && destinationListId) {
      if (destinationListId === activeListId) {
        addTargetsBatch(batchItems);
      } else {
        batchItems.forEach((item) => {
          addEntryToList(destinationListId, {
            ...item,
            priority: 'medium',
          });
        });
      }
        options?.clearSelection?.();
        options?.onBatchAdd?.(selected);
      }
  }, [activeListId, addEntryToList, addTargetsBatch, destinationListId, options]);

  return { handleAddToTargetList, handleBatchAdd };
}
