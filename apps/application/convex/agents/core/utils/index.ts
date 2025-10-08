/**
 * Core utilities for agents
 * 
 * This module provides shared utility functions including
 * text normalization and search utilities.
 */

export { normalizeAndBuildMaps, normalizeQuery } from "./textNormalization";
export { 
  buildDocIndex,
  findMatches,
  selectByOccurrence,
  findAnchorPosition
} from "./normalizedSearch";


