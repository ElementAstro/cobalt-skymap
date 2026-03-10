/**
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useObjectSearch, getDetailedMatch } from '../use-object-search';
import { getResultId } from '@/lib/core/search-utils';

// Mock the stores
jest.mock('@/lib/stores', () => ({
  useStellariumStore: jest.fn(() => null),
}));

jest.mock('@/lib/stores/target-list-store', () => ({
  useTargetListStore: jest.fn(() => []),
}));

const mockRecentSearches: { query: string }[] = [];
const mockSearchStoreState = {
  currentSearchMode: 'local' as 'local' | 'online' | 'hybrid',
  settings: { timeout: 15000, groupBySource: false },
  lastStatusCheck: Date.now(),
  onlineStatus: {
    local: true,
    sesame: true,
    simbad: true,
    vizier: true,
    ned: true,
    mpc: true,
  },
  getEnabledSources: jest.fn(() => ['local', 'sesame', 'simbad']),
  addRecentSearch: jest.fn((query: string) => {
    if (query.trim() && !mockRecentSearches.some(s => s.query === query)) {
      mockRecentSearches.unshift({ query });
    }
  }),
  getRecentSearches: jest.fn(() => mockRecentSearches),
  clearRecentSearches: jest.fn(() => { mockRecentSearches.length = 0; }),
  updateAllOnlineStatus: jest.fn(),
  cacheSearchResults: jest.fn(),
  getCachedResults: jest.fn(() => null),
  setMaxRecentSearches: jest.fn(),
};

const mockUseSearchStore = Object.assign(
  jest.fn((selector?: (state: typeof mockSearchStoreState) => unknown) => {
    if (typeof selector === 'function') {
      return selector(mockSearchStoreState);
    }
    return mockSearchStoreState;
  }),
  {
    getState: () => mockSearchStoreState,
  }
);
const mockSettingsState = {
  search: {
    enableFuzzySearch: true,
    autoSearchDelay: 150,
    maxSearchResults: 50,
    includeMinorObjects: true,
    rememberSearchHistory: true,
    maxHistoryItems: 20,
  },
};

jest.mock('@/lib/stores/search-store', () => {
  const useSearchStore = (...args: unknown[]) =>
    (mockUseSearchStore as (...a: unknown[]) => unknown)(...args);
  (useSearchStore as typeof useSearchStore & { getState: () => typeof mockSearchStoreState }).getState = () =>
    mockUseSearchStore.getState();
  return { useSearchStore };
});

jest.mock('@/lib/services/online-search-service', () => ({
  searchOnlineByName: jest.fn().mockResolvedValue({ results: [], sources: [], totalCount: 0, searchTimeMs: 0 }),
  // Return a never-resolving promise to avoid async setState outside act()
  checkOnlineSearchAvailability: jest.fn().mockReturnValue(new Promise(() => {})),
}));

jest.mock('@/lib/stores/settings-store', () => ({
  useSettingsStore: jest.fn((selector) => {
    return typeof selector === 'function' ? selector(mockSettingsState) : mockSettingsState;
  }),
}));

jest.mock('@/lib/astronomy/coordinates/conversions', () => ({
  parseRACoordinate: jest.fn((v: string) => {
    const n = parseFloat(v);
    return !isNaN(n) && n >= 0 && n < 360 ? n : null;
  }),
  parseDecCoordinate: jest.fn((v: string) => {
    const n = parseFloat(v);
    return !isNaN(n) && n >= -90 && n <= 90 ? n : null;
  }),
}));

describe('useObjectSearch', () => {
  const getOnlineSearchMock = () => {
    const mod = jest.requireMock('@/lib/services/online-search-service') as {
      searchOnlineByName: jest.Mock;
    };
    return mod.searchOnlineByName;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockRecentSearches.length = 0;
    mockSearchStoreState.currentSearchMode = 'local';
    mockSearchStoreState.settings = { timeout: 15000, groupBySource: false };
    mockSearchStoreState.lastStatusCheck = Date.now();
    mockSearchStoreState.onlineStatus = {
      local: true,
      sesame: true,
      simbad: true,
      vizier: true,
      ned: true,
      mpc: true,
    };
    mockSearchStoreState.getEnabledSources.mockClear();
    mockSearchStoreState.addRecentSearch.mockClear();
    mockSearchStoreState.getRecentSearches.mockClear();
    mockSearchStoreState.clearRecentSearches.mockClear();
    mockSearchStoreState.updateAllOnlineStatus.mockClear();
    mockSearchStoreState.cacheSearchResults.mockClear();
    mockSearchStoreState.getCachedResults.mockClear();
    mockSearchStoreState.getCachedResults.mockReturnValue(null);
    mockSearchStoreState.setMaxRecentSearches.mockClear();
    mockSettingsState.search.enableFuzzySearch = true;
    mockSettingsState.search.autoSearchDelay = 150;
    mockSettingsState.search.maxSearchResults = 50;
    mockSettingsState.search.includeMinorObjects = true;
    mockSettingsState.search.rememberSearchHistory = true;
    mockSettingsState.search.maxHistoryItems = 20;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initial state', () => {
    it('should have empty initial state', () => {
      const { result } = renderHook(() => useObjectSearch());
      
      expect(result.current.query).toBe('');
      expect(result.current.results).toEqual([]);
      expect(result.current.isSearching).toBe(false);
      expect(result.current.searchOutcome).toBe('empty');
      expect(result.current.searchMessages).toEqual([]);
    });

    it('should have default filters', () => {
      const { result } = renderHook(() => useObjectSearch());
      
      expect(result.current.filters.types).toContain('DSO');
      expect(result.current.filters.types).toContain('Planet');
      expect(result.current.filters.includeTargetList).toBe(true);
      expect(result.current.filters.searchMode).toBe('name');
    });

    it('should have default sort by relevance', () => {
      const { result } = renderHook(() => useObjectSearch());
      
      expect(result.current.sortBy).toBe('relevance');
    });

    it('should have popular objects available', () => {
      const { result } = renderHook(() => useObjectSearch());
      
      expect(result.current.popularObjects).toBeDefined();
      expect(result.current.popularObjects.length).toBeGreaterThan(0);
    });

    it('should expose online search state', () => {
      const { result } = renderHook(() => useObjectSearch());
      
      expect(result.current.isOnlineSearching).toBe(false);
      expect(typeof result.current.onlineAvailable).toBe('boolean');
    });
  });

  describe('search', () => {
    it('should update query', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.setQuery('M31');
      });
      
      expect(result.current.query).toBe('M31');
    });

    it('should find Messier objects', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.search('M31');
        jest.advanceTimersByTime(200);
      });
      
      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
      });
      
      const m31 = result.current.results.find(
        r =>
          r.Name.toLowerCase() === 'm31' ||
          r.Name.toLowerCase().includes('messier 31') ||
          r['Common names']?.toLowerCase().includes('andromeda')
      );
      expect(m31).toBeDefined();
    });

    it('should find objects by common name', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.search('Andromeda');
        jest.advanceTimersByTime(200);
      });
      
      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
      });
      
      // Should find M31 (Andromeda Galaxy) or Andromeda constellation
      const hasAndromeda = result.current.results.some(
        r => r.Name.includes('Andromeda') || r['Common names']?.includes('Andromeda')
      );
      expect(hasAndromeda).toBe(true);
    });

    it('should find planets', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.search('Jupiter');
        jest.advanceTimersByTime(200);
      });
      
      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
      });
      
      const jupiter = result.current.results.find(r => r.Name === 'Jupiter');
      expect(jupiter).toBeDefined();
      expect(jupiter?.Type).toBe('Planet');
    });

    it('should find constellations', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.search('Orion');
        jest.advanceTimersByTime(200);
      });
      
      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
      });
      
      const orion = result.current.results.find(r => r.Type === 'Constellation');
      expect(orion).toBeDefined();
    });

    it('should debounce search', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.search('M');
        result.current.search('M3');
        result.current.search('M31');
      });
      
      // Before debounce completes
      expect(result.current.results).toEqual([]);
      
      act(() => {
        jest.advanceTimersByTime(200);
      });
      
      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
      });
    });

    it('should clear results for empty query', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      // First search
      act(() => {
        result.current.search('M31');
        jest.advanceTimersByTime(200);
      });
      
      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
      });
      
      // Clear search
      act(() => {
        result.current.search('');
        jest.advanceTimersByTime(200);
      });
      
      await waitFor(() => {
        expect(result.current.results).toEqual([]);
        expect(result.current.searchOutcome).toBe('empty');
      });
    });

    it('reports partial_success and preserves local results when hybrid online fails', async () => {
      const searchOnlineByName = getOnlineSearchMock();
      searchOnlineByName.mockRejectedValueOnce(new Error('timeout'));
      mockSearchStoreState.currentSearchMode = 'hybrid';

      const { result } = renderHook(() => useObjectSearch());

      act(() => {
        result.current.search('M31');
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
      });

      expect(result.current.searchOutcome).toBe('partial_success');
      expect(result.current.searchMessages.length).toBeGreaterThan(0);
    });

    it('clears stale results and reports error when online search fails', async () => {
      const searchOnlineByName = getOnlineSearchMock();
      mockSearchStoreState.currentSearchMode = 'local';

      const { result, rerender } = renderHook(() => useObjectSearch());

      act(() => {
        result.current.search('M31');
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
      });

      mockSearchStoreState.currentSearchMode = 'online';
      searchOnlineByName.mockRejectedValueOnce(new Error('provider-down'));
      rerender();

      act(() => {
        result.current.search('M31');
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(result.current.searchOutcome).toBe('error');
      });

      expect(result.current.results).toEqual([]);
      expect(result.current.searchMessages.length).toBeGreaterThan(0);
    });
  });

  describe('clearSearch', () => {
    it('should clear query and results', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.search('M31');
        jest.advanceTimersByTime(200);
      });
      
      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
      });
      
      act(() => {
        result.current.clearSearch();
      });
      
      expect(result.current.query).toBe('');
      expect(result.current.results).toEqual([]);
    });

    it('should clear selection', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.search('M31');
        jest.advanceTimersByTime(200);
      });
      
      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
      });
      
      act(() => {
        result.current.selectAll();
        result.current.clearSearch();
      });
      
      expect(result.current.selectedIds.size).toBe(0);
    });
  });

  describe('selection', () => {
    it('should toggle selection', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.search('M31');
        jest.advanceTimersByTime(200);
      });
      
      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
      });
      
      const firstResult = result.current.results[0];
      const id = getResultId(firstResult);
      
      act(() => {
        result.current.toggleSelection(id);
      });
      
      expect(result.current.isSelected(id)).toBe(true);
      
      act(() => {
        result.current.toggleSelection(id);
      });
      
      expect(result.current.isSelected(id)).toBe(false);
    });

    it('should select all results', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.search('M3');
        jest.advanceTimersByTime(200);
      });
      
      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
      });
      
      act(() => {
        result.current.selectAll();
      });
      
      expect(result.current.selectedIds.size).toBe(result.current.results.length);
    });

    it('should clear selection', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.search('M31');
        jest.advanceTimersByTime(200);
      });
      
      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
      });
      
      act(() => {
        result.current.selectAll();
        result.current.clearSelection();
      });
      
      expect(result.current.selectedIds.size).toBe(0);
    });

    it('should get selected items', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.search('M31');
        jest.advanceTimersByTime(200);
      });
      
      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
      });
      
      const firstResult = result.current.results[0];
      const id = getResultId(firstResult);
      
      act(() => {
        result.current.toggleSelection(id);
      });
      
      const selected = result.current.getSelectedItems();
      expect(selected.length).toBe(1);
      expect(selected[0].Name).toBe(firstResult.Name);
    });
  });

  describe('filters', () => {
    it('should update filters', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.setFilters({ types: ['DSO'] });
      });
      
      expect(result.current.filters.types).toEqual(['DSO']);
    });

    it('should merge with existing filters', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.setFilters({ minMagnitude: 5 });
      });
      
      expect(result.current.filters.minMagnitude).toBe(5);
      expect(result.current.filters.types).toBeDefined();
    });
  });

  describe('sorting', () => {
    it('should update sort option', () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.setSortBy('name');
      });
      
      expect(result.current.sortBy).toBe('name');
    });
  });

  describe('recent searches', () => {
    it('should delegate addRecentSearch to store', () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.addRecentSearch('M31');
      });
      
      // Verify the store mock was called
      expect(mockRecentSearches.some(s => s.query === 'M31')).toBe(true);
    });

    it('should delegate clearRecentSearches to store', () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.addRecentSearch('M31');
        result.current.clearRecentSearches();
      });
      
      expect(mockRecentSearches).toEqual([]);
    });

    it('should expose recentSearches from store', () => {
      const { result } = renderHook(() => useObjectSearch());
      
      // recentSearches should be an array (from store)
      expect(Array.isArray(result.current.recentSearches)).toBe(true);
    });

    it('should disable history when rememberSearchHistory is false', () => {
      mockSettingsState.search.rememberSearchHistory = false;
      const { result } = renderHook(() => useObjectSearch());

      act(() => {
        result.current.addRecentSearch('M31');
      });

      expect(mockSearchStoreState.addRecentSearch).not.toHaveBeenCalled();
      expect(result.current.recentSearches).toEqual([]);
    });
  });

  describe('search stats', () => {
    it('should provide search statistics', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.search('M31');
        jest.advanceTimersByTime(200);
      });
      
      await waitFor(() => {
        expect(result.current.searchStats).not.toBeNull();
      });
      
      expect(result.current.searchStats?.totalResults).toBeGreaterThan(0);
      expect(result.current.searchStats?.searchTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('grouped results', () => {
    it('should group results by type', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.search('M');
        jest.advanceTimersByTime(200);
      });
      
      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
      });
      
      expect(result.current.groupedResults).toBeInstanceOf(Map);
    });

    it('should group by source when groupBySource is enabled', async () => {
      mockSearchStoreState.settings = { timeout: 15000, groupBySource: true };
      const { result } = renderHook(() => useObjectSearch());

      act(() => {
        result.current.search('M31');
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
      });

      expect(result.current.groupedResults.has('local')).toBe(true);
    });
  });

  describe('quick categories', () => {
    it('should provide quick categories', () => {
      const { result } = renderHook(() => useObjectSearch());
      
      expect(result.current.quickCategories).toBeDefined();
      expect(result.current.quickCategories.length).toBeGreaterThan(0);
      
      result.current.quickCategories.forEach(category => {
        expect(category.label).toBeDefined();
        expect(category.items).toBeDefined();
      });
    });

    it('should include messier category', () => {
      const { result } = renderHook(() => useObjectSearch());
      
      const messierCategory = result.current.quickCategories.find(c => c.label === 'messier');
      expect(messierCategory).toBeDefined();
      expect(messierCategory!.items.length).toBeGreaterThan(0);
    });

    it('should include planets category', () => {
      const { result } = renderHook(() => useObjectSearch());
      
      const planetsCategory = result.current.quickCategories.find(c => c.label === 'planets');
      expect(planetsCategory).toBeDefined();
    });
  });

  describe('search result enrichment', () => {
    it('should enrich DSO results with altitude data', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.search('M31');
        jest.advanceTimersByTime(200);
      });
      
      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
      });
      
      const dsoResult = result.current.results.find(r => r.Type === 'DSO');
      if (dsoResult) {
        // Enrichment should have computed altitude data
        expect(dsoResult._currentAltitude).toBeDefined();
        expect(typeof dsoResult._currentAltitude).toBe('number');
        expect(typeof dsoResult._isVisible).toBe('boolean');
      }
    });

    it('should enrich DSO results with moon distance', async () => {
      const { result } = renderHook(() => useObjectSearch());
      
      act(() => {
        result.current.search('M42');
        jest.advanceTimersByTime(200);
      });
      
      await waitFor(() => {
        expect(result.current.results.length).toBeGreaterThan(0);
      });
      
      const dsoResult = result.current.results.find(r => r.Type === 'DSO');
      if (dsoResult) {
        expect(dsoResult._moonDistance).toBeDefined();
        expect(typeof dsoResult._moonDistance).toBe('number');
      }
    });
  });
});

describe('getDetailedMatch', () => {
  it('should return match result for exact match', () => {
    const item = { Name: 'M31', Type: 'DSO' as const };
    const result = getDetailedMatch(item, 'M31');
    
    expect(result.score).toBeGreaterThan(0);
    expect(result.matchType).toBeDefined();
  });

  it('should return match result for partial match', () => {
    const item = { Name: 'M31', Type: 'DSO' as const, 'Common names': 'Andromeda Galaxy' };
    const result = getDetailedMatch(item, 'andromeda');
    
    expect(result.score).toBeGreaterThan(0);
  });

  it('should return low score for non-match', () => {
    const item = { Name: 'M31', Type: 'DSO' as const };
    const result = getDetailedMatch(item, 'xyz123');
    
    expect(result.score).toBeLessThan(0.3);
  });
});
