/**
 * Tests for use-target-list-actions.ts
 * Target list add/batch-add actions
 */

import { renderHook, act } from '@testing-library/react';
import { useTargetListActions } from '../use-target-list-actions';
import type { SearchResultItem } from '@/lib/core/types';
import { useTargetListStore } from '@/lib/stores/target-list-store';

describe('useTargetListActions', () => {
  beforeEach(() => {
    useTargetListStore.getState().clearAll();
  });

  it('should return action handlers', () => {
    const { result } = renderHook(() => useTargetListActions());
    expect(typeof result.current.handleAddToTargetList).toBe('function');
    expect(typeof result.current.handleBatchAdd).toBe('function');
  });

  it('should call handleAddToTargetList without error', () => {
    const { result } = renderHook(() => useTargetListActions());
    const item: SearchResultItem = {
      Name: 'M31',
      Type: 'DSO',
      RA: 10.68,
      Dec: 41.27,
    };
    act(() => {
      result.current.handleAddToTargetList(item);
    });
    // Should not throw
  });

  it('should skip items without RA/Dec', () => {
    const { result } = renderHook(() => useTargetListActions());
    const item: SearchResultItem = {
      Name: 'Unknown',
      Type: 'Star',
    };
    act(() => {
      result.current.handleAddToTargetList(item);
    });
    // Should not throw, just skip
  });

  it('should handle batch add with getSelectedItems', () => {
    const items: SearchResultItem[] = [
      { Name: 'M31', Type: 'DSO', RA: 10.68, Dec: 41.27 },
      { Name: 'M42', Type: 'DSO', RA: 83.82, Dec: -5.39 },
    ];
    const getSelectedItems = jest.fn(() => items);
    const clearSelection = jest.fn();

    const { result } = renderHook(() =>
      useTargetListActions({ getSelectedItems, clearSelection })
    );

    act(() => {
      result.current.handleBatchAdd();
    });

    expect(getSelectedItems).toHaveBeenCalled();
    expect(clearSelection).toHaveBeenCalled();
  });

  it('adds targets to the provided destination list', () => {
    const activeListId = useTargetListStore.getState().activeListId;
    const destinationListId = useTargetListStore.getState().createList({ name: 'Secondary' });
    const item: SearchResultItem = {
      Name: 'M31',
      Type: 'DSO',
      RA: 10.68,
      Dec: 41.27,
    };

    const { result } = renderHook(() =>
      useTargetListActions({ targetListId: destinationListId })
    );

    act(() => {
      result.current.handleAddToTargetList(item);
    });

    expect(useTargetListStore.getState().getEntriesForList(destinationListId)).toHaveLength(1);
    expect(useTargetListStore.getState().getEntriesForList(activeListId)).toHaveLength(0);
  });
});
