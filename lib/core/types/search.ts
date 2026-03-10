/**
 * Search-related type definitions
 */

import type { StellariumObject } from './stellarium';

// ============================================================================
// Search Result Types
// ============================================================================

export type SearchResultType = 
  | 'Comet' 
  | 'Asteroid'
  | 'Planet' 
  | 'Star' 
  | 'Moon' 
  | 'StellariumObject' 
  | 'DSO' 
  | 'Constellation' 
  | 'Coordinates';

export type SearchRunOutcome = 'success' | 'partial_success' | 'empty' | 'error';

export type SearchMessageLevel = 'warning' | 'error';

export interface SearchRunMessage {
  source: string;
  level: SearchMessageLevel;
  message: string;
  code?: string;
}

export interface SearchResultItem {
  Name: string;
  Type?: SearchResultType;
  RA?: number;
  Dec?: number;
  'Common names'?: string;
  CanonicalId?: string;
  Identifiers?: string[];
  M?: string;
  Magnitude?: number;
  Size?: string;
  StellariumObj?: StellariumObject;
  _fuzzyScore?: number;
  _isOnlineResult?: boolean;
  _onlineSource?: string;
  _sourcePriority?: number;
  _angularSeparation?: number; // arcsec from coordinate query center
  _stableId?: string;
  _currentAltitude?: number;
  _isVisible?: boolean;
  _transitTime?: Date;
  _moonDistance?: number;
  _imagingScore?: number;
}

// ============================================================================
// Object Type Classifications
// ============================================================================

export type ObjectTypeCategory = 
  | 'galaxy' 
  | 'nebula' 
  | 'cluster' 
  | 'star' 
  | 'planet' 
  | 'comet'
  | 'asteroid'
  | 'other';

// ============================================================================
// Search Filter Types
// ============================================================================

export type ObjectType = 
  | 'all' 
  | 'galaxy' 
  | 'nebula' 
  | 'cluster' 
  | 'star' 
  | 'planet' 
  | 'comet' 
  | 'asteroid'
  | 'constellation';

export type SortOption = 
  | 'name' 
  | 'magnitude' 
  | 'size' 
  | 'altitude' 
  | 'transit';

export interface SearchFilters {
  objectType: ObjectType;
  minMagnitude: number | null;
  maxMagnitude: number | null;
  minAltitude: number | null;
  sortBy: SortOption;
  sortOrder: 'asc' | 'desc';
}
