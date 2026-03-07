/**
 * @jest-environment jsdom
 */

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/lib/services/daily-knowledge', () => ({
  getDailyKnowledge: jest.fn(),
}));

jest.mock('@/lib/services/online-search-service', () => ({
  resolveObjectName: jest.fn(),
}));

import { useDailyKnowledgeStore, getLocalDateKey } from '../daily-knowledge-store';
import { useSettingsStore } from '../settings-store';
import { useStellariumStore } from '../stellarium-store';
import { getDailyKnowledge } from '@/lib/services/daily-knowledge';
import { resolveObjectName } from '@/lib/services/online-search-service';

const mockGetDailyKnowledge = getDailyKnowledge as jest.MockedFunction<typeof getDailyKnowledge>;
const mockResolveObjectName = resolveObjectName as jest.MockedFunction<typeof resolveObjectName>;

const baseResult = {
  items: [
    {
      id: 'curated-andromeda-distance',
      dateKey: '2026-02-20',
      source: 'curated' as const,
      title: 'Andromeda Is A Time Machine',
      summary: 'summary',
      body: 'body',
      contentLanguage: 'en',
      categories: ['object' as const],
      tags: ['M31'],
      relatedObjects: [{ name: 'M31', ra: 10.6847, dec: 41.2687 }],
      attribution: { sourceName: 'Curated' },
      isDateEvent: false,
      factSources: [{ title: 'SEDS M31', url: 'https://messier.seds.org/m/m031.html', publisher: 'SEDS' }],
      languageStatus: 'native' as const,
      fetchedAt: Date.now(),
    },
  ],
  selected: {
    id: 'curated-andromeda-distance',
    dateKey: '2026-02-20',
    source: 'curated' as const,
    title: 'Andromeda Is A Time Machine',
    summary: 'summary',
    body: 'body',
    contentLanguage: 'en',
    categories: ['object' as const],
    tags: ['M31'],
    relatedObjects: [{ name: 'M31', ra: 10.6847, dec: 41.2687 }],
    attribution: { sourceName: 'Curated' },
    isDateEvent: false,
    factSources: [{ title: 'SEDS M31', url: 'https://messier.seds.org/m/m031.html', publisher: 'SEDS' }],
    languageStatus: 'native' as const,
    fetchedAt: Date.now(),
  },
};

function resetDailyStore() {
  useDailyKnowledgeStore.setState({
    favorites: [],
    history: [],
    lastShownDate: null,
    snoozedDate: null,
    lastSeenItemId: null,
    viewMode: 'pager',
    wheelPagingEnabled: false,
    open: false,
    loading: false,
    error: null,
    currentItem: null,
    items: [],
    filters: {
      query: '',
      category: 'all',
      source: 'all',
      favoritesOnly: false,
    },
  });
}

describe('daily-knowledge-store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetDailyStore();
    useSettingsStore.setState((state) => ({
      preferences: {
        ...state.preferences,
        dailyKnowledgeEnabled: true,
        dailyKnowledgeAutoShow: true,
        dailyKnowledgeOnlineEnhancement: true,
      },
    }));
    useStellariumStore.setState({
      setViewDirection: jest.fn(),
    });
    mockGetDailyKnowledge.mockResolvedValue(baseResult);
  });

  it('toggles favorites', () => {
    const store = useDailyKnowledgeStore.getState();

    store.toggleFavorite('curated-andromeda-distance');
    expect(useDailyKnowledgeStore.getState().favorites).toHaveLength(1);

    store.toggleFavorite('curated-andromeda-distance');
    expect(useDailyKnowledgeStore.getState().favorites).toHaveLength(0);
  });

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

  it('caps history to 120 entries', () => {
    const store = useDailyKnowledgeStore.getState();
    for (let i = 0; i < 140; i += 1) {
      store.recordHistory(`item-${i}`, 'manual', '2026-02-20');
    }

    const history = useDailyKnowledgeStore.getState().history;
    expect(history).toHaveLength(120);
    expect(history[0].itemId).toBe('item-139');
  });

  it('marks do-not-show-today and blocks auto-show', () => {
    const store = useDailyKnowledgeStore.getState();

    expect(store.shouldAutoShowToday()).toBe(true);
    store.markDontShowToday();

    expect(useDailyKnowledgeStore.getState().snoozedDate).toBe(getLocalDateKey());
    expect(useDailyKnowledgeStore.getState().shouldAutoShowToday()).toBe(false);
  });

  it('honors settings-based auto-show gating', () => {
    useSettingsStore.setState((state) => ({
      preferences: {
        ...state.preferences,
        dailyKnowledgeAutoShow: false,
      },
    }));
    expect(useDailyKnowledgeStore.getState().shouldAutoShowToday()).toBe(false);

    useSettingsStore.setState((state) => ({
      preferences: {
        ...state.preferences,
        dailyKnowledgeAutoShow: true,
      },
    }));
    useDailyKnowledgeStore.setState({ lastShownDate: getLocalDateKey() });

    expect(useDailyKnowledgeStore.getState().shouldAutoShowToday()).toBe(false);
  });

  it('loads daily content and updates startup state for auto entry', async () => {
    await useDailyKnowledgeStore.getState().loadDaily('auto');

    const state = useDailyKnowledgeStore.getState();
    expect(state.currentItem?.id).toBe('curated-andromeda-distance');
    expect(state.lastShownDate).toBe(getLocalDateKey());
    expect(state.history[0].entry).toBe('auto');
  });

  it('refreshes stale cached items when opening dialog on a new date', async () => {
    useDailyKnowledgeStore.setState({
      items: [
        {
          ...baseResult.items[0],
          id: 'yesterday-item',
          dateKey: '2026-02-19',
        },
      ],
      currentItem: {
        ...baseResult.items[0],
        id: 'yesterday-item',
        dateKey: '2026-02-19',
      },
    });

    await useDailyKnowledgeStore.getState().openDialog('manual');

    expect(mockGetDailyKnowledge).toHaveBeenCalled();
    expect(useDailyKnowledgeStore.getState().currentItem?.id).toBe('curated-andromeda-distance');
  });

  it('jumps using embedded coordinates before name resolution', async () => {
    const setViewDirection = jest.fn();
    useStellariumStore.setState({ setViewDirection });

    await useDailyKnowledgeStore.getState().goToRelatedObject({
      name: 'M31',
      ra: 10.6847,
      dec: 41.2687,
    });

    expect(setViewDirection).toHaveBeenCalledWith(10.6847, 41.2687);
    expect(mockResolveObjectName).not.toHaveBeenCalled();
  });

  it('resolves object name when coordinates are not provided', async () => {
    const setViewDirection = jest.fn();
    useStellariumStore.setState({ setViewDirection });
    mockResolveObjectName.mockResolvedValue({
      id: 'm42',
      name: 'M42',
      canonicalId: 'M42',
      identifiers: ['M42'],
      confidence: 0.9,
      category: 'nebula',
      type: 'Nebula',
      ra: 83.8221,
      dec: -5.3911,
      source: 'sesame',
    });

    await useDailyKnowledgeStore.getState().goToRelatedObject({ name: 'M42' });

    expect(mockResolveObjectName).toHaveBeenCalledWith('M42');
    expect(setViewDirection).toHaveBeenCalledWith(83.8221, -5.3911);
  });
});
