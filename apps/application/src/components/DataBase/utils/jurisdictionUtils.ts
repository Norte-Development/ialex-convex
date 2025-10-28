/**
 * Utility functions for handling jurisdiction codes and display names
 */

export interface JurisdictionMap {
  [key: string]: string;
}

// Mapping of jurisdiction codes to human-readable names
export const JURISDICTION_NAMES: JurisdictionMap = {
  'all': 'Todas',
  'nac': 'Nacional',
  'nacional': 'Nacional',
  // Argentina provinces
  'bue': 'Buenos Aires',
  'cba': 'Córdoba',
  'sfe': 'Santa Fe',
  'men': 'Mendoza',
  'tuc': 'Tucumán',
  'ent': 'Entre Ríos',
  'sal': 'Salta',
  'mis': 'Misiones',
  'cor': 'Corrientes',
  'sju': 'San Juan',
  'juj': 'Jujuy',
  'rio': 'Río Negro',
  'chu': 'Chubut',
  'neu': 'Neuquén',
  'for': 'Formosa',
  'lpz': 'La Pampa',
  'slz': 'San Luis',
  'cat': 'Catamarca',
  'lri': 'La Rioja',
  'sgo': 'Santiago del Estero',
  'chc': 'Chaco',
  'scz': 'Santa Cruz',
  'tdf': 'Tierra del Fuego',
  // Paraguay departments
  'asuncion': 'Asunción',
  'concepcion': 'Concepción',
  'san_pedro': 'San Pedro',
  'cordillera': 'Cordillera',
  'guaira': 'Guairá',
  'caaguazu': 'Caaguazú',
  'caazapa': 'Caazapá',
  'itapua': 'Itapúa',
  'misiones': 'Misiones',
  'paraguari': 'Paraguarí',
  'alto_parana': 'Alto Paraná',
  'central': 'Central',
  'neembucu': 'Ñeembucú',
  'amambay': 'Amambay',
  'canindeyu': 'Canindeyú',
  'presidente_hayes': 'Presidente Hayes',
  'boqueron': 'Boquerón',
  'alto_paraguay': 'Alto Paraguay',
};

/**
 * Get the display name for a jurisdiction code
 * @param code - The jurisdiction code (e.g., 'nac', 'bue', 'all')
 * @returns The human-readable name, or capitalized code if not found
 */
export function getJurisdictionName(code: string | undefined): string {
  if (!code) return '-';
  
  // Check if we have a mapping for this code
  const name = JURISDICTION_NAMES[code.toLowerCase()];
  if (name) return name;
  
  // If no mapping found, capitalize the first letter
  return code.charAt(0).toUpperCase() + code.slice(1);
}

/**
 * Get jurisdiction label with optional count for dropdown/filter display
 * @param code - The jurisdiction code
 * @param count - Optional count to display
 * @returns Formatted label string
 */
export function getJurisdictionLabelWithCount(code: string, count?: number): string {
  const name = getJurisdictionName(code);
  return count !== undefined ? `${name} (${count.toLocaleString()})` : name;
}

