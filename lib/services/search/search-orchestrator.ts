import type { SearchResultItem, SearchRunMessage, SearchRunOutcome } from '@/lib/core/types';
import {
  searchOnlineByCoordinates,
  searchOnlineByName,
  type OnlineSearchResponse,
  type OnlineSearchResult,
  type OnlineSearchSource,
} from '@/lib/services/online-search-service';
import { formatRA, formatDec } from '@/lib/astronomy/coordinates/formats';
import { parseSearchQuery } from './query-parser';
import { mergeSearchItems } from './search-merge';
import type { ParsedSearchQuery, SearchIntent } from './search-intent';

export type UnifiedSearchMode = 'local' | 'online' | 'hybrid';

export interface UnifiedSearchOptions {
  query: string;
  mode: UnifiedSearchMode;
  onlineAvailable: boolean;
  enabledSources: OnlineSearchSource[];
  timeout: number;
  maxResults: number;
  searchRadiusDeg: number;
  includeMinorObjects: boolean;
  signal?: AbortSignal;
  localSearch?: (context: {
    parsed: ParsedSearchQuery;
    query: string;
  }) => Promise<SearchResultItem[]> | SearchResultItem[];
  cachedOnline?: OnlineSearchResult[];
}

export interface BatchSearchItem {
  query: string;
  results: SearchResultItem[];
  outcome: SearchRunOutcome;
  issues?: SearchRunIssue[];
  errors?: string[];
  warnings?: string[];
}

export type SearchRunIssue = SearchRunMessage;

export interface UnifiedSearchResult {
  parsed: ParsedSearchQuery;
  intent: SearchIntent;
  outcome: SearchRunOutcome;
  results: SearchResultItem[];
  localResults: SearchResultItem[];
  onlineResults: SearchResultItem[];
  onlineResponse?: OnlineSearchResponse;
  issues: SearchRunIssue[];
  errors: string[];
  warnings: string[];
  batchItems?: BatchSearchItem[];
}

const DEFAULT_SOURCES: OnlineSearchSource[] = ['sesame', 'simbad', 'vizier', 'ned', 'mpc'];

function onlineResultToSearchItem(result: OnlineSearchResult): SearchResultItem {
  const typeMap: Record<string, string> = {
    galaxy: 'DSO',
    nebula: 'DSO',
    cluster: 'DSO',
    star: 'Star',
    planet: 'Planet',
    comet: 'Comet',
    asteroid: 'Asteroid',
    quasar: 'DSO',
    other: 'DSO',
  };

  return {
    Name: result.name,
    Type: (typeMap[result.category] || 'DSO') as SearchResultItem['Type'],
    RA: result.ra,
    Dec: result.dec,
    CanonicalId: result.canonicalId,
    Identifiers: result.identifiers,
    'Common names': result.alternateNames?.join(', '),
    Magnitude: result.magnitude,
    Size: result.angularSize,
    _isOnlineResult: true,
    _onlineSource: result.source,
  };
}

function passesMinorObjectFilter(
  result: OnlineSearchResult,
  includeMinorObjects: boolean,
  explicitMinor: boolean
): boolean {
  if (explicitMinor) return true;
  if (includeMinorObjects) return true;
  const lowerType = result.type.toLowerCase();
  return !(
    result.category === 'comet' ||
    result.category === 'asteroid' ||
    lowerType.includes('minor planet') ||
    lowerType.includes('asteroid') ||
    lowerType.includes('comet')
  );
}

async function mapBatchInParallel<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const result: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      result[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return result;
}

function deriveOutcome(results: SearchResultItem[], issues: SearchRunIssue[]): SearchRunOutcome {
  if (results.length > 0) {
    return issues.length > 0 ? 'partial_success' : 'success';
  }
  return issues.length > 0 ? 'error' : 'empty';
}

function summarizeIssues(issues: SearchRunIssue[]): { errors: string[]; warnings: string[] } {
  return {
    errors: issues.filter(i => i.level === 'error').map(i => i.message),
    warnings: issues.filter(i => i.level === 'warning').map(i => i.message),
  };
}

async function runSingleSearch(
  options: UnifiedSearchOptions,
  parsed: ParsedSearchQuery
): Promise<UnifiedSearchResult> {
  const query = parsed.catalogQuery || parsed.normalized;
  const issues: SearchRunIssue[] = [];
  const localSearch = options.localSearch;
  const shouldUseLocal = options.mode === 'local' || options.mode === 'hybrid';
  const shouldUseOnline = options.mode !== 'local' && options.onlineAvailable;

  if (options.mode === 'online' && !options.onlineAvailable) {
    issues.push({
      source: 'online',
      level: 'error',
      code: 'ONLINE_UNAVAILABLE',
      message: 'Online search is unavailable',
    });
  }

  const localResults: SearchResultItem[] =
    shouldUseLocal && localSearch
      ? await Promise.resolve(localSearch({ parsed, query }))
      : [];

  let onlineResponse: OnlineSearchResponse | undefined;
  let onlineResults: SearchResultItem[] = [];

  if (shouldUseOnline) {
    try {
      if (parsed.intent === 'coordinates' && parsed.coordinates) {
        onlineResponse = await searchOnlineByCoordinates(
          { ra: parsed.coordinates.ra, dec: parsed.coordinates.dec, radius: options.searchRadiusDeg },
          {
            sources: options.enabledSources.length > 0 ? options.enabledSources : ['simbad'],
            limit: options.maxResults,
            timeout: options.timeout,
            signal: options.signal,
          }
        );
      } else {
        onlineResponse = await searchOnlineByName(query, {
          sources: options.enabledSources.length > 0 ? options.enabledSources : DEFAULT_SOURCES,
          limit: options.maxResults,
          timeout: options.timeout,
          signal: options.signal,
        });
      }
    } catch (error) {
      issues.push({
        source: 'online',
        level: options.mode === 'online' ? 'error' : 'warning',
        code: 'ONLINE_REQUEST_FAILED',
        message: error instanceof Error ? error.message : 'Online search failed',
      });
    }
  }

  const onlineRaw = onlineResponse?.results ?? (shouldUseOnline ? options.cachedOnline ?? [] : []);
  onlineResults = onlineRaw
    .filter(result => passesMinorObjectFilter(result, options.includeMinorObjects, parsed.explicitMinor))
    .map(onlineResultToSearchItem);

  if (onlineResponse?.errors?.length) {
    issues.push(
      ...onlineResponse.errors.map((err) => ({
        source: err.source,
        level: 'warning' as const,
        code: 'ONLINE_PROVIDER_ERROR',
        message: `${err.source}: ${err.error}`,
      }))
    );
  }

  const merged = mergeSearchItems(localResults, onlineResults, {
    maxResults: options.maxResults,
    coordinateContext: parsed.coordinates,
  });
  const outcome = deriveOutcome(merged, issues);
  const { errors, warnings } = summarizeIssues(issues);

  return {
    parsed,
    intent: parsed.intent,
    outcome,
    results: merged,
    localResults,
    onlineResults,
    onlineResponse,
    issues,
    errors,
    warnings,
  };
}

export async function searchUnified(options: UnifiedSearchOptions): Promise<UnifiedSearchResult> {
  const parsed = parseSearchQuery(options.query);
  if (!parsed.normalized) {
    return {
      parsed,
      intent: parsed.intent,
      outcome: 'empty',
      results: [],
      localResults: [],
      onlineResults: [],
      issues: [],
      errors: [],
      warnings: [],
    };
  }

  if (parsed.intent !== 'batch' || !parsed.batchQueries?.length) {
    return runSingleSearch(options, parsed);
  }

  const batchResults = await mapBatchInParallel(parsed.batchQueries, 3, async (query) => {
    const itemParsed = parseSearchQuery(query);
    const itemResult = await runSingleSearch({ ...options, query }, itemParsed);
    return {
      query,
      results: itemResult.results,
      outcome: itemResult.outcome,
      issues: itemResult.issues.length > 0 ? itemResult.issues : undefined,
      errors: itemResult.errors.length > 0 ? itemResult.errors : undefined,
      warnings: itemResult.warnings.length > 0 ? itemResult.warnings : undefined,
    } as BatchSearchItem;
  });

  const flattened = mergeSearchItems(
    batchResults.flatMap(item => item.results),
    [],
    { maxResults: options.maxResults }
  );
  const issues = batchResults.flatMap((item) =>
    (item.issues ?? []).map((issue) => ({
      ...issue,
      source: `${issue.source}[${item.query}]`,
    }))
  );
  const outcome = deriveOutcome(flattened, issues);
  const { errors, warnings } = summarizeIssues(issues);

  return {
    parsed,
    intent: 'batch',
    outcome,
    results: flattened,
    localResults: [],
    onlineResults: [],
    issues,
    errors,
    warnings,
    batchItems: batchResults,
  };
}

export function createCoordinateSearchResult(ra: number, dec: number): SearchResultItem {
  return {
    Name: `${formatRA(ra)} ${formatDec(dec)}`,
    Type: 'Coordinates',
    RA: ra,
    Dec: dec,
    CanonicalId: `coord:${ra.toFixed(6)},${dec.toFixed(6)}`,
    'Common names': 'Custom Coordinates',
  };
}
