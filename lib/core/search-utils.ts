/**
 * Search utility functions
 * Pure helper functions for search operations
 */

import type { SearchResultItem } from './types';

/**
 * Legacy id format retained for backward compatibility.
 */
export function getLegacyResultId(item: SearchResultItem): string {
  return `${item.Type || 'unknown'}-${item.Name}`;
}

function normalizeToken(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function formatCoordinate(value: number): string {
  return Number.isFinite(value) ? value.toFixed(6) : `${value}`;
}

/**
 * Canonical id format for collision-safe selection/actions.
 */
export function getCanonicalResultId(item: SearchResultItem): string | null {
  const preferredCanonical = item.CanonicalId || item.Identifiers?.[0];
  if (preferredCanonical) {
    return `canonical:${normalizeToken(preferredCanonical)}`;
  }

  if (item.RA !== undefined && item.Dec !== undefined) {
    const type = normalizeToken(item.Type || 'unknown');
    return `coord:${type}:${formatCoordinate(item.RA)},${formatCoordinate(item.Dec)}`;
  }

  return null;
}

/**
 * Get a stable id for a search result item.
 * Prefers canonical identity and falls back to legacy type-name format.
 */
export function getResultId(item: SearchResultItem): string {
  if (item._stableId) {
    return item._stableId;
  }

  return getCanonicalResultId(item) ?? getLegacyResultId(item);
}
