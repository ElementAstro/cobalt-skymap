import { mergeSearchItems } from '../search-merge';
import type { SearchResultItem } from '@/lib/core/types';

describe('mergeSearchItems', () => {
  it('deduplicates by close coordinates', () => {
    const local: SearchResultItem[] = [
      { Name: 'M31', Type: 'DSO', RA: 10.6847, Dec: 41.2689 },
    ];
    const online: SearchResultItem[] = [
      {
        Name: 'Andromeda Galaxy',
        Type: 'DSO',
        RA: 10.68471,
        Dec: 41.26891,
        _onlineSource: 'simbad',
      },
    ];

    const merged = mergeSearchItems(local, online, { maxResults: 20 });
    expect(merged).toHaveLength(1);
    expect(merged[0]['Common names']).toContain('Andromeda Galaxy');
  });

  it('keeps unique objects', () => {
    const local: SearchResultItem[] = [{ Name: 'M31', Type: 'DSO', RA: 10, Dec: 20 }];
    const online: SearchResultItem[] = [{ Name: 'M42', Type: 'DSO', RA: 30, Dec: 40, _onlineSource: 'sesame' }];
    const merged = mergeSearchItems(local, online, { maxResults: 20 });
    expect(merged).toHaveLength(2);
  });

  it('computes coordinate distance when context provided', () => {
    const online: SearchResultItem[] = [{ Name: 'M42', Type: 'DSO', RA: 83.8, Dec: -5.3, _onlineSource: 'simbad' }];
    const merged = mergeSearchItems([], online, {
      maxResults: 20,
      coordinateContext: { ra: 83.9, dec: -5.4 },
    });
    expect(merged[0]._angularSeparation).toBeDefined();
  });

  it('merges aliases when canonical ids match', () => {
    const local: SearchResultItem[] = [
      { Name: 'M31', Type: 'DSO', CanonicalId: 'M31', RA: 10.6847, Dec: 41.2689 },
    ];
    const online: SearchResultItem[] = [
      {
        Name: 'Andromeda Galaxy',
        Type: 'DSO',
        CanonicalId: 'Messier 31',
        Identifiers: ['M31'],
        RA: 10.6848,
        Dec: 41.2688,
        _onlineSource: 'sesame',
      },
    ];

    const merged = mergeSearchItems(local, online, { maxResults: 20 });
    expect(merged).toHaveLength(1);
    expect(merged[0]['Common names']).toContain('Andromeda Galaxy');
  });

  it('keeps near-name collisions as separate objects when coordinates differ', () => {
    const local: SearchResultItem[] = [{ Name: 'NGC 123', Type: 'DSO', RA: 10.0, Dec: 20.0 }];
    const online: SearchResultItem[] = [{ Name: 'NGC123', Type: 'DSO', RA: 11.0, Dec: 21.0, _onlineSource: 'simbad' }];

    const merged = mergeSearchItems(local, online, { maxResults: 20, coordinateThresholdArcsec: 1 });
    expect(merged).toHaveLength(2);
    expect(merged[0]._stableId).toBeDefined();
    expect(merged[1]._stableId).toBeDefined();
  });
});
