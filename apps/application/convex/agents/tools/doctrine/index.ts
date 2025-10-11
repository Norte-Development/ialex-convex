/**
 * Doctrine Tools Module
 * 
 * This module provides tools for searching and reading legal doctrine from
 * authorized Argentine legal databases.
 * 
 * @module doctrine
 * 
 * @remarks
 * Available tools:
 * - `searchDoctrineTool`: Search for doctrine across multiple legal databases
 * - `readDoctrineTool`: Read and extract full content from a doctrine URL
 * 
 * Supported sources:
 * - SAIJ (Sistema Argentino de Información Jurídica)
 * - Pensamiento Penal
 * 
 * @example
 * ```typescript
 * import { searchDoctrineTool, readDoctrineTool } from './doctrine';
 * 
 * // Search for doctrine
 * const results = await searchDoctrineTool.handler(ctx, {
 *   searchTerm: "derecho constitucional"
 * });
 * 
 * // Read specific doctrine article
 * const content = await readDoctrineTool.handler(ctx, {
 *   url: "https://www.saij.gob.ar/some-article"
 * });
 * ```
 */

export { searchDoctrineTool } from './searchDoctrineTool';
export { readDoctrineTool } from './readDoctrine';