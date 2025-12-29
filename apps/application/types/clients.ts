/**
 * Modelo canónico y jurídicamente correcto para clientes en iAlex
 * Basado en CCyCN (Código Civil y Comercial de la Nación) y LGS (Ley General de Sociedades)
 *
 * Este archivo define la arquitectura de tipos que replica la estructura del Derecho argentino.
 */

// ============================================
// CAPA 1 - NATURALEZA JURÍDICA
// ============================================

/**
 * Naturaleza jurídica del cliente - campo canónico que gobierna toda la lógica posterior
 * - humana: Persona humana (Art. 19 CCyCN)
 * - juridica: Persona jurídica (Art. 141 CCyCN)
 */
export type NaturalezaJuridica = "humana" | "juridica";

// ============================================
// CAPA 2 - PERSONA HUMANA
// ============================================

/**
 * Actividad económica de la persona humana
 * Impacta directamente en: Defensa del consumidor, Contratos, Responsabilidad
 */
export type ActividadEconomica =
  | "sin_actividad" // Consumidor puro
  | "profesional" // Profesional independiente (abogado, médico, etc.)
  | "comerciante"; // Comerciante individual (inscripto en el Registro Público)

/**
 * Clasificación jurídica resultante para persona humana
 * Se deriva de la actividad económica
 */
export type ClasificacionPersonaHumana =
  | "consumidor" // Sin actividad económica
  | "profesional_independiente" // Profesional
  | "comerciante_individual"; // Comerciante

// ============================================
// CAPA 2 - PERSONA JURÍDICA
// ============================================

/**
 * Tipos de persona jurídica según CCyCN (Art. 148)
 * Este campo es obligatorio y no admite valores ambiguos
 */
export type TipoPersonaJuridica =
  | "sociedad" // Sociedades comerciales (LGS)
  | "asociacion_civil" // Asociación Civil (Art. 168 CCyCN)
  | "fundacion" // Fundación (Art. 193 CCyCN)
  | "cooperativa" // Cooperativa (Ley 20.337)
  | "ente_publico" // Entes estatales y mixtos
  | "consorcio" // Consorcio de Propiedad Horizontal (Art. 2044 CCyCN)
  | "otro"; // Otros tipos (requiere descripción)

// ============================================
// CAPA 3 - TIPO DE SOCIEDAD (LGS + SAS)
// ============================================

/**
 * Tipos societarios según LGS 19.550 y Ley 27.349 (SAS)
 * Define: Régimen de responsabilidad, Capacidad de representación, Riesgo legal
 */
export type TipoSociedad =
  | "SA" // Sociedad Anónima (Art. 163 LGS)
  | "SAS" // Sociedad por Acciones Simplificada (Ley 27.349)
  | "SRL" // Sociedad de Responsabilidad Limitada (Art. 146 LGS)
  | "COLECTIVA" // Sociedad Colectiva (Art. 125 LGS)
  | "COMANDITA_SIMPLE" // Sociedad en Comandita Simple (Art. 134 LGS)
  | "COMANDITA_ACCIONES" // Sociedad en Comandita por Acciones (Art. 315 LGS)
  | "CAPITAL_INDUSTRIA" // Sociedad de Capital e Industria (Art. 141 LGS)
  | "IRREGULAR" // Sociedad no constituida regularmente (Art. 21 LGS) ⚠️ ALERTA LEGAL
  | "HECHO" // Sociedad de hecho (Art. 21 LGS) ⚠️ ALERTA LEGAL
  | "OTRO"; // Otro tipo (requiere descripción)

// ============================================
// LABELS PARA UI
// ============================================

export const NATURALEZA_JURIDICA_LABELS: Record<NaturalezaJuridica, string> = {
  humana: "Persona Humana",
  juridica: "Persona Jurídica",
};

export const ACTIVIDAD_ECONOMICA_LABELS: Record<ActividadEconomica, string> = {
  sin_actividad: "Sin actividad económica",
  profesional: "Profesional independiente",
  comerciante: "Comerciante",
};

export const TIPO_PERSONA_JURIDICA_LABELS: Record<TipoPersonaJuridica, string> =
  {
    sociedad: "Sociedad",
    asociacion_civil: "Asociación Civil",
    fundacion: "Fundación",
    cooperativa: "Cooperativa",
    ente_publico: "Ente Público",
    consorcio: "Consorcio de Propiedad Horizontal",
    otro: "Otro",
  };

export const TIPO_SOCIEDAD_LABELS: Record<TipoSociedad, string> = {
  SA: "Sociedad Anónima (S.A.)",
  SAS: "Sociedad por Acciones Simplificada (S.A.S.)",
  SRL: "Sociedad de Responsabilidad Limitada (S.R.L.)",
  COLECTIVA: "Sociedad Colectiva",
  COMANDITA_SIMPLE: "Sociedad en Comandita Simple",
  COMANDITA_ACCIONES: "Sociedad en Comandita por Acciones",
  CAPITAL_INDUSTRIA: "Sociedad de Capital e Industria",
  IRREGULAR: "Sociedad Irregular ⚠️",
  HECHO: "Sociedad de Hecho ⚠️",
  OTRO: "Otro tipo societario",
};

// Opciones simplificadas para UX (según documento)
export const TIPO_SOCIEDAD_UX_PRINCIPAL: TipoSociedad[] = [
  "SA",
  "SAS",
  "SRL",
  "COLECTIVA",
  "COMANDITA_SIMPLE",
  "COMANDITA_ACCIONES",
  "OTRO",
];

// ============================================
// HELPERS
// ============================================

/**
 * Determina si un tipo de sociedad requiere alerta legal
 */
export function requiereAlertaLegal(tipo: TipoSociedad): boolean {
  return tipo === "IRREGULAR" || tipo === "HECHO";
}

/**
 * Determina si un tipo de sociedad es comandita (para subselector)
 */
export function esComandita(tipo: TipoSociedad): boolean {
  return tipo === "COMANDITA_SIMPLE" || tipo === "COMANDITA_ACCIONES";
}

/**
 * Obtiene la clasificación jurídica resultante de una persona humana
 */
export function getClasificacionPersonaHumana(
  actividad: ActividadEconomica,
): ClasificacionPersonaHumana {
  switch (actividad) {
    case "sin_actividad":
      return "consumidor";
    case "profesional":
      return "profesional_independiente";
    case "comerciante":
      return "comerciante_individual";
  }
}

/**
 * Determina si el CUIT es obligatorio según el tipo de cliente
 */
export function esCuitObligatorio(
  naturaleza: NaturalezaJuridica,
  actividad?: ActividadEconomica,
): boolean {
  // Personas jurídicas siempre requieren CUIT
  if (naturaleza === "juridica") return true;

  // Personas humanas con actividad económica requieren CUIT
  if (naturaleza === "humana" && actividad && actividad !== "sin_actividad") {
    return true;
  }

  return false;
}

// ============================================
// INTERFAZ COMPLETA DEL CLIENTE
// ============================================

export interface ClienteBase {
  // Identificación
  _id?: string;

  // Capa 1 - Naturaleza Jurídica (obligatorio)
  naturalezaJuridica: NaturalezaJuridica;

  // Contacto (común a todos)
  email?: string;
  phone?: string;
  domicilioLegal?: string;

  // Notas
  notes?: string;

  // Sistema
  isActive: boolean;
  createdBy?: string;
}

export interface ClientePersonaHumana extends ClienteBase {
  naturalezaJuridica: "humana";

  // Datos personales
  nombre: string;
  apellido: string;
  dni: string; // Obligatorio
  cuit?: string; // Condicional según actividad

  // Clasificación económica
  actividadEconomica: ActividadEconomica;
  profesionEspecifica?: string; // Si es profesional o comerciante
}

export interface ClientePersonaJuridica extends ClienteBase {
  naturalezaJuridica: "juridica";

  // Datos de la entidad
  razonSocial: string;
  cuit: string; // Obligatorio

  // Clasificación jurídica
  tipoPersonaJuridica: TipoPersonaJuridica;

  // Solo si tipoPersonaJuridica === "sociedad"
  tipoSociedad?: TipoSociedad;

  // Si tipoSociedad === "OTRO" o tipoPersonaJuridica === "otro"
  descripcionOtro?: string;
}

export type Cliente = ClientePersonaHumana | ClientePersonaJuridica;

// ============================================
// VALIDACIONES
// ============================================

export interface ValidationError {
  field: string;
  message: string;
}

export function validateClientePersonaHumana(
  cliente: Partial<ClientePersonaHumana>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!cliente.nombre?.trim()) {
    errors.push({ field: "nombre", message: "El nombre es requerido" });
  }

  if (!cliente.apellido?.trim()) {
    errors.push({ field: "apellido", message: "El apellido es requerido" });
  }

  if (!cliente.dni?.trim()) {
    errors.push({
      field: "dni",
      message: "El DNI es requerido para personas humanas",
    });
  }

  if (!cliente.actividadEconomica) {
    errors.push({
      field: "actividadEconomica",
      message: "La actividad económica es requerida",
    });
  }

  // CUIT obligatorio si tiene actividad económica
  if (
    cliente.actividadEconomica &&
    cliente.actividadEconomica !== "sin_actividad" &&
    !cliente.cuit?.trim()
  ) {
    errors.push({
      field: "cuit",
      message: "El CUIT es requerido para profesionales y comerciantes",
    });
  }

  return errors;
}

export function validateClientePersonaJuridica(
  cliente: Partial<ClientePersonaJuridica>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!cliente.razonSocial?.trim()) {
    errors.push({
      field: "razonSocial",
      message: "La razón social es requerida",
    });
  }

  if (!cliente.cuit?.trim()) {
    errors.push({
      field: "cuit",
      message: "El CUIT es obligatorio para personas jurídicas",
    });
  }

  if (!cliente.tipoPersonaJuridica) {
    errors.push({
      field: "tipoPersonaJuridica",
      message: "El tipo de persona jurídica es requerido",
    });
  }

  // Si es sociedad, debe especificar el tipo
  if (cliente.tipoPersonaJuridica === "sociedad" && !cliente.tipoSociedad) {
    errors.push({
      field: "tipoSociedad",
      message: "El tipo de sociedad es requerido",
    });
  }

  // Si es "otro", debe tener descripción
  if (
    (cliente.tipoPersonaJuridica === "otro" ||
      cliente.tipoSociedad === "OTRO") &&
    !cliente.descripcionOtro?.trim()
  ) {
    errors.push({
      field: "descripcionOtro",
      message: "La descripción es requerida para tipos no listados",
    });
  }

  return errors;
}

/**
 * Valida un cliente completo según su naturaleza jurídica
 */
export function validateCliente(cliente: Partial<Cliente>): ValidationError[] {
  if (!cliente.naturalezaJuridica) {
    return [
      {
        field: "naturalezaJuridica",
        message: "La naturaleza jurídica es requerida",
      },
    ];
  }

  if (cliente.naturalezaJuridica === "humana") {
    return validateClientePersonaHumana(
      cliente as Partial<ClientePersonaHumana>,
    );
  }

  return validateClientePersonaJuridica(
    cliente as Partial<ClientePersonaJuridica>,
  );
}

// ============================================
// UTILIDADES DE DISPLAY
// ============================================

/**
 * Obtiene el nombre de display de un cliente
 */
export function getClienteDisplayName(cliente: Cliente): string {
  if (cliente.naturalezaJuridica === "humana") {
    return `${cliente.nombre} ${cliente.apellido}`;
  }
  return cliente.razonSocial;
}

/**
 * Obtiene la descripción del tipo de cliente para mostrar en UI
 */
export function getClienteTipoDescription(cliente: Cliente): string {
  if (cliente.naturalezaJuridica === "humana") {
    const clasificacion = getClasificacionPersonaHumana(
      cliente.actividadEconomica,
    );
    switch (clasificacion) {
      case "consumidor":
        return "Persona Humana - Consumidor";
      case "profesional_independiente":
        return `Persona Humana - Profesional${cliente.profesionEspecifica ? ` (${cliente.profesionEspecifica})` : ""}`;
      case "comerciante_individual":
        return "Persona Humana - Comerciante Individual";
    }
  }

  const tipoLabel = TIPO_PERSONA_JURIDICA_LABELS[cliente.tipoPersonaJuridica];

  if (cliente.tipoPersonaJuridica === "sociedad" && cliente.tipoSociedad) {
    return TIPO_SOCIEDAD_LABELS[cliente.tipoSociedad];
  }

  return tipoLabel;
}

/**
 * Obtiene el identificador principal del cliente (DNI o CUIT)
 */
export function getClienteIdentificador(cliente: Cliente): string {
  if (cliente.naturalezaJuridica === "humana") {
    return `DNI: ${cliente.dni}`;
  }
  return `CUIT: ${cliente.cuit}`;
}
