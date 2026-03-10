import { searchUnified } from '../search-orchestrator';
import { searchOnlineByCoordinates, searchOnlineByName } from '@/lib/services/online-search-service';

jest.mock('@/lib/services/online-search-service', () => ({
  searchOnlineByName: jest.fn().mockResolvedValue({
    results: [
      {
        id: 'sesame-m31',
        name: 'M 31',
        canonicalId: 'M31',
        identifiers: ['M31'],
        confidence: 0.9,
        type: 'Galaxy',
        category: 'galaxy',
        ra: 10.6847,
        dec: 41.2689,
        source: 'sesame',
      },
    ],
    sources: ['sesame'],
    totalCount: 1,
    searchTimeMs: 10,
  }),
  searchOnlineByCoordinates: jest.fn().mockResolvedValue({
    results: [
      {
        id: 'simbad-m42',
        name: 'M 42',
        canonicalId: 'M42',
        identifiers: ['M42'],
        confidence: 0.9,
        type: 'Nebula',
        category: 'nebula',
        ra: 83.822,
        dec: -5.391,
        source: 'simbad',
      },
    ],
    sources: ['simbad'],
    totalCount: 1,
    searchTimeMs: 10,
  }),
}));

describe('searchUnified', () => {
  const mockSearchOnlineByName = searchOnlineByName as jest.MockedFunction<typeof searchOnlineByName>;
  const mockSearchOnlineByCoordinates =
    searchOnlineByCoordinates as jest.MockedFunction<typeof searchOnlineByCoordinates>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('supports catalog intent and merges local + online', async () => {
    const result = await searchUnified({
      query: 'm:31',
      mode: 'hybrid',
      onlineAvailable: true,
      enabledSources: ['sesame', 'simbad'],
      timeout: 5000,
      maxResults: 20,
      searchRadiusDeg: 5,
      includeMinorObjects: true,
      localSearch: () => [{ Name: 'M31', Type: 'DSO' as const, RA: 10.6846, Dec: 41.2688 }],
    });

    expect(result.intent).toBe('catalog');
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.outcome).toBe('success');
  });

  it('supports coordinate intent', async () => {
    const result = await searchUnified({
      query: '@83.822,-5.391',
      mode: 'online',
      onlineAvailable: true,
      enabledSources: ['simbad'],
      timeout: 5000,
      maxResults: 20,
      searchRadiusDeg: 2,
      includeMinorObjects: true,
    });

    expect(result.intent).toBe('coordinates');
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.outcome).toBe('success');
    expect(mockSearchOnlineByCoordinates).toHaveBeenCalledWith(
      expect.objectContaining({ radius: 2 }),
      expect.any(Object)
    );
  });

  it('supports batch intent', async () => {
    const result = await searchUnified({
      query: 'M31\nM42',
      mode: 'hybrid',
      onlineAvailable: true,
      enabledSources: ['sesame'],
      timeout: 5000,
      maxResults: 20,
      searchRadiusDeg: 5,
      includeMinorObjects: true,
      localSearch: () => [],
    });

    expect(result.intent).toBe('batch');
    expect(result.batchItems?.length).toBe(2);
    expect(result.outcome).toBe('success');
  });

  it('uses local mode without online requests', async () => {
    const localSearch = jest.fn(() => [{ Name: 'M31', Type: 'DSO' as const, RA: 10.6846, Dec: 41.2688 }]);

    const result = await searchUnified({
      query: 'M31',
      mode: 'local',
      onlineAvailable: true,
      enabledSources: ['sesame', 'simbad'],
      timeout: 5000,
      maxResults: 20,
      searchRadiusDeg: 5,
      includeMinorObjects: true,
      localSearch,
    });

    expect(localSearch).toHaveBeenCalled();
    expect(mockSearchOnlineByName).not.toHaveBeenCalled();
    expect(result.results).toHaveLength(1);
    expect(result.outcome).toBe('success');
  });

  it('keeps local matches in hybrid mode when online request fails', async () => {
    mockSearchOnlineByName.mockRejectedValueOnce(new Error('timeout'));

    const result = await searchUnified({
      query: 'M31',
      mode: 'hybrid',
      onlineAvailable: true,
      enabledSources: ['sesame'],
      timeout: 5000,
      maxResults: 20,
      searchRadiusDeg: 5,
      includeMinorObjects: true,
      localSearch: () => [{ Name: 'M31', Type: 'DSO' as const, RA: 10.6846, Dec: 41.2688 }],
    });

    expect(result.results).toHaveLength(1);
    expect(result.outcome).toBe('partial_success');
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('reports error in online mode when online search is unavailable', async () => {
    const localSearch = jest.fn(() => [{ Name: 'M31', Type: 'DSO' as const, RA: 10.6846, Dec: 41.2688 }]);

    const result = await searchUnified({
      query: 'M31',
      mode: 'online',
      onlineAvailable: false,
      enabledSources: ['sesame'],
      timeout: 5000,
      maxResults: 20,
      searchRadiusDeg: 5,
      includeMinorObjects: true,
      localSearch,
    });

    expect(localSearch).not.toHaveBeenCalled();
    expect(result.results).toHaveLength(0);
    expect(result.outcome).toBe('error');
    expect(result.errors).toContain('Online search is unavailable');
  });

  it('filters minor objects when includeMinorObjects is false', async () => {
    mockSearchOnlineByName.mockResolvedValueOnce({
      results: [
        {
          id: 'comet-1',
          name: 'Comet 1',
          canonicalId: 'COMET1',
          identifiers: ['Comet 1'],
          confidence: 0.9,
          type: 'Comet',
          category: 'comet',
          ra: 1,
          dec: 1,
          source: 'sesame',
        },
      ],
      sources: ['sesame'],
      totalCount: 1,
      searchTimeMs: 10,
    });

    const result = await searchUnified({
      query: 'Comet 1',
      mode: 'online',
      onlineAvailable: true,
      enabledSources: ['sesame'],
      timeout: 5000,
      maxResults: 20,
      searchRadiusDeg: 5,
      includeMinorObjects: false,
    });

    expect(result.results).toHaveLength(0);
    expect(result.outcome).toBe('empty');
  });

  it('keeps explicit minor-object queries even when includeMinorObjects is false', async () => {
    mockSearchOnlineByName.mockResolvedValueOnce({
      results: [
        {
          id: 'mpc-2007-ta418',
          name: '2007 TA418',
          canonicalId: '2007TA418',
          identifiers: ['2007 TA418', 'K07Tf8A'],
          confidence: 0.99,
          type: 'Asteroid',
          category: 'asteroid',
          ra: 36.9,
          dec: -9.0,
          source: 'mpc',
        },
      ],
      sources: ['mpc'],
      totalCount: 1,
      searchTimeMs: 10,
    });

    const result = await searchUnified({
      query: 'K07Tf8A',
      mode: 'online',
      onlineAvailable: true,
      enabledSources: ['mpc'],
      timeout: 5000,
      maxResults: 20,
      searchRadiusDeg: 5,
      includeMinorObjects: false,
    });

    expect(result.intent).toBe('minor');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].Type).toBe('Asteroid');
    expect(result.outcome).toBe('success');
  });
});
