/**
 * Core module - Shared types and constants
 * This module contains all shared type definitions and constants
 * to avoid circular dependencies between modules.
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Equipment normalization
export { normalizeTelescopes, normalizeCameras } from './equipment-normalize';

// Management validators
export { validateTelescopeForm, validateCameraForm, validateLocationForm } from './management-validators';

// Search utilities
export { getResultId, getCanonicalResultId, getLegacyResultId } from './search-utils';

// Selection utilities
export { buildSelectionData } from './selection-utils';
