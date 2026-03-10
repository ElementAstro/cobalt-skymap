import { parseSearchQuery } from '../query-parser';

describe('parseSearchQuery', () => {
  it('parses plain text as name intent', () => {
    const parsed = parseSearchQuery('Andromeda Galaxy');
    expect(parsed.intent).toBe('name');
    expect(parsed.normalized).toBe('Andromeda Galaxy');
  });

  it('parses catalog command prefixes', () => {
    expect(parseSearchQuery('m:31')).toMatchObject({
      intent: 'catalog',
      catalogQuery: 'M31',
      commandPrefix: 'm',
    });
    expect(parseSearchQuery('ngc: 7000')).toMatchObject({
      intent: 'catalog',
      catalogQuery: 'NGC7000',
      commandPrefix: 'ngc',
    });
    expect(parseSearchQuery('hip: 70890')).toMatchObject({
      intent: 'catalog',
      catalogQuery: 'HIP70890',
      commandPrefix: 'hip',
    });
  });

  it('parses coordinates with @ prefix', () => {
    const parsed = parseSearchQuery('@05:34:32, +22:00:52');
    expect(parsed.intent).toBe('coordinates');
    expect(parsed.coordinates).toBeDefined();
  });

  it('parses decimal coordinate input without prefix', () => {
    const parsed = parseSearchQuery('83.633, 22.014');
    expect(parsed.intent).toBe('coordinates');
    expect(parsed.coordinates).toMatchObject({ ra: 83.633, dec: 22.014 });
  });

  it('normalizes full-width punctuation', () => {
    const parsed = parseSearchQuery('m：31');
    expect(parsed.intent).toBe('catalog');
    expect(parsed.catalogQuery).toBe('M31');
  });

  it('parses coordinates with full-width comma', () => {
    const parsed = parseSearchQuery('@83.633，22.014');
    expect(parsed.intent).toBe('coordinates');
    expect(parsed.coordinates).toMatchObject({ ra: 83.633, dec: 22.014 });
  });

  it('falls back to name intent for invalid coordinates', () => {
    const parsed = parseSearchQuery('@999,200');
    expect(parsed.intent).toBe('name');
    expect(parsed.coordinates).toBeUndefined();
  });

  it('parses multi-line input as batch search', () => {
    const parsed = parseSearchQuery('M31\nNGC7000\n火星');
    expect(parsed.intent).toBe('batch');
    expect(parsed.batchQueries).toEqual(['M31', 'NGC7000', '火星']);
  });

  it('detects explicit minor-object queries', () => {
    const parsed = parseSearchQuery('K07Tf8A');
    expect(parsed.intent).toBe('minor');
    expect(parsed.explicitMinor).toBe(true);
  });
});
