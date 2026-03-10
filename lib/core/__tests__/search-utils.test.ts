/**
 * Tests for search-utils.ts
 * Search result ID generation
 */

import { getCanonicalResultId, getLegacyResultId, getResultId } from '../search-utils';
import type { SearchResultItem } from '../types';

describe('getResultId', () => {
  it('falls back to legacy type-name format', () => {
    const item: SearchResultItem = { Type: 'DSO', Name: 'M31' };
    expect(getResultId(item)).toBe('DSO-M31');
    expect(getLegacyResultId(item)).toBe('DSO-M31');
  });

  it('prefers canonical id when available', () => {
    const item: SearchResultItem = { Type: 'DSO', Name: 'M31', CanonicalId: ' Messier 31 ' };
    expect(getCanonicalResultId(item)).toBe('canonical:messier 31');
    expect(getResultId(item)).toBe('canonical:messier 31');
  });

  it('uses coordinates as canonical fallback when ids are missing', () => {
    const item: SearchResultItem = { Type: 'DSO', Name: 'Object', RA: 10.1234567, Dec: -20.7654321 };
    expect(getResultId(item)).toBe('coord:dso:10.123457,-20.765432');
  });

  it('keeps near-name collisions distinct by coordinate-based ids', () => {
    const a: SearchResultItem = { Type: 'DSO', Name: 'NGC 123', RA: 10.1, Dec: 20.1 };
    const b: SearchResultItem = { Type: 'DSO', Name: 'NGC 123', RA: 10.2, Dec: 20.2 };
    expect(getResultId(a)).not.toBe(getResultId(b));
  });
});
