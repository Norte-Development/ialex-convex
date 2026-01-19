/**
 * PJN Role Mapping Configuration
 * 
 * Maps PJN Interviniente roles to local client roles.
 * This defines the canonical mapping between PJN terminology and the application's role system.
 */

// Local role types used in the application
export type LocalRole =
  | "ACTOR" // Plaintiff / Actor
  | "DEMANDADO" // Defendant
  | "TERCERO" // Third party
  | "ABOGADO_ACTOR" // Plaintiff's attorney
  | "ABOGADO_DEMANDADO" // Defendant's attorney
  | "FISCAL" // Prosecutor
  | "DEFENSOR" // Public defender
  | "JUEZ" // Judge
  | "PERITO" // Expert witness
  | "TESTIGO" // Witness
  | "QUERELLANTE" // Private prosecutor (criminal)
  | "IMPUTADO" // Accused (criminal)
  | "OTRO"; // Other/Unknown

// Side classification for grouping roles
export type RoleSide = "ACTOR_SIDE" | "DEMANDADO_SIDE" | "NEUTRAL" | "JUDICIAL";

// Role mapping entry
export interface RoleMapping {
  localRole: LocalRole;
  side: RoleSide;
  displayName: string;
  displayNameEs: string;
}

/**
 * Mapping from PJN raw roles to local roles.
 * Keys are normalized (uppercase, trimmed) PJN role strings.
 */
export const PJN_ROLE_MAPPING: Record<string, RoleMapping> = {
  // Actor/Plaintiff side
  "ACTOR": { localRole: "ACTOR", side: "ACTOR_SIDE", displayName: "Plaintiff", displayNameEs: "Actor" },
  "ACTORA": { localRole: "ACTOR", side: "ACTOR_SIDE", displayName: "Plaintiff", displayNameEs: "Actora" },
  "PARTE ACTORA": { localRole: "ACTOR", side: "ACTOR_SIDE", displayName: "Plaintiff", displayNameEs: "Parte Actora" },
  "QUERELLANTE": { localRole: "QUERELLANTE", side: "ACTOR_SIDE", displayName: "Private Prosecutor", displayNameEs: "Querellante" },
  "DENUNCIANTE": { localRole: "ACTOR", side: "ACTOR_SIDE", displayName: "Complainant", displayNameEs: "Denunciante" },
  "RECLAMANTE": { localRole: "ACTOR", side: "ACTOR_SIDE", displayName: "Claimant", displayNameEs: "Reclamante" },
  "DEMANDANTE": { localRole: "ACTOR", side: "ACTOR_SIDE", displayName: "Plaintiff", displayNameEs: "Demandante" },
  
  // Actor attorneys
  "ABOGADO ACTOR": { localRole: "ABOGADO_ACTOR", side: "ACTOR_SIDE", displayName: "Plaintiff's Attorney", displayNameEs: "Abogado Actor" },
  "ABOGADO ACTORA": { localRole: "ABOGADO_ACTOR", side: "ACTOR_SIDE", displayName: "Plaintiff's Attorney", displayNameEs: "Abogado Actora" },
  "ABOGADO DE LA PARTE ACTORA": { localRole: "ABOGADO_ACTOR", side: "ACTOR_SIDE", displayName: "Plaintiff's Attorney", displayNameEs: "Abogado de la Parte Actora" },
  "ABOGADO QUERELLANTE": { localRole: "ABOGADO_ACTOR", side: "ACTOR_SIDE", displayName: "Prosecutor's Attorney", displayNameEs: "Abogado Querellante" },
  "APODERADO ACTOR": { localRole: "ABOGADO_ACTOR", side: "ACTOR_SIDE", displayName: "Plaintiff's Representative", displayNameEs: "Apoderado Actor" },
  "LETRADO ACTOR": { localRole: "ABOGADO_ACTOR", side: "ACTOR_SIDE", displayName: "Plaintiff's Lawyer", displayNameEs: "Letrado Actor" },
  "PATROCINANTE ACTOR": { localRole: "ABOGADO_ACTOR", side: "ACTOR_SIDE", displayName: "Sponsoring Attorney (Plaintiff)", displayNameEs: "Patrocinante Actor" },
  
  // Defendant side
  "DEMANDADO": { localRole: "DEMANDADO", side: "DEMANDADO_SIDE", displayName: "Defendant", displayNameEs: "Demandado" },
  "DEMANDADA": { localRole: "DEMANDADO", side: "DEMANDADO_SIDE", displayName: "Defendant", displayNameEs: "Demandada" },
  "PARTE DEMANDADA": { localRole: "DEMANDADO", side: "DEMANDADO_SIDE", displayName: "Defendant", displayNameEs: "Parte Demandada" },
  "IMPUTADO": { localRole: "IMPUTADO", side: "DEMANDADO_SIDE", displayName: "Accused", displayNameEs: "Imputado" },
  "IMPUTADA": { localRole: "IMPUTADO", side: "DEMANDADO_SIDE", displayName: "Accused", displayNameEs: "Imputada" },
  "ACUSADO": { localRole: "IMPUTADO", side: "DEMANDADO_SIDE", displayName: "Accused", displayNameEs: "Acusado" },
  "ACUSADA": { localRole: "IMPUTADO", side: "DEMANDADO_SIDE", displayName: "Accused", displayNameEs: "Acusada" },
  "PROCESADO": { localRole: "IMPUTADO", side: "DEMANDADO_SIDE", displayName: "Indicted", displayNameEs: "Procesado" },
  
  // Defendant attorneys
  "ABOGADO DEMANDADO": { localRole: "ABOGADO_DEMANDADO", side: "DEMANDADO_SIDE", displayName: "Defendant's Attorney", displayNameEs: "Abogado Demandado" },
  "ABOGADO DEMANDADA": { localRole: "ABOGADO_DEMANDADO", side: "DEMANDADO_SIDE", displayName: "Defendant's Attorney", displayNameEs: "Abogado Demandada" },
  "ABOGADO DE LA PARTE DEMANDADA": { localRole: "ABOGADO_DEMANDADO", side: "DEMANDADO_SIDE", displayName: "Defendant's Attorney", displayNameEs: "Abogado de la Parte Demandada" },
  "APODERADO DEMANDADO": { localRole: "ABOGADO_DEMANDADO", side: "DEMANDADO_SIDE", displayName: "Defendant's Representative", displayNameEs: "Apoderado Demandado" },
  "LETRADO DEMANDADO": { localRole: "ABOGADO_DEMANDADO", side: "DEMANDADO_SIDE", displayName: "Defendant's Lawyer", displayNameEs: "Letrado Demandado" },
  "PATROCINANTE DEMANDADO": { localRole: "ABOGADO_DEMANDADO", side: "DEMANDADO_SIDE", displayName: "Sponsoring Attorney (Defendant)", displayNameEs: "Patrocinante Demandado" },
  "DEFENSOR": { localRole: "DEFENSOR", side: "DEMANDADO_SIDE", displayName: "Public Defender", displayNameEs: "Defensor" },
  "DEFENSOR OFICIAL": { localRole: "DEFENSOR", side: "DEMANDADO_SIDE", displayName: "Official Public Defender", displayNameEs: "Defensor Oficial" },
  "DEFENSOR PARTICULAR": { localRole: "ABOGADO_DEMANDADO", side: "DEMANDADO_SIDE", displayName: "Private Defense Attorney", displayNameEs: "Defensor Particular" },
  
  // Third parties
  "TERCERO": { localRole: "TERCERO", side: "NEUTRAL", displayName: "Third Party", displayNameEs: "Tercero" },
  "TERCERO CITADO": { localRole: "TERCERO", side: "NEUTRAL", displayName: "Summoned Third Party", displayNameEs: "Tercero Citado" },
  "TERCERO INTERESADO": { localRole: "TERCERO", side: "NEUTRAL", displayName: "Interested Third Party", displayNameEs: "Tercero Interesado" },
  "CITADO EN GARANTIA": { localRole: "TERCERO", side: "NEUTRAL", displayName: "Guarantor", displayNameEs: "Citado en Garantía" },
  "ASEGURADORA": { localRole: "TERCERO", side: "NEUTRAL", displayName: "Insurance Company", displayNameEs: "Aseguradora" },
  "ART": { localRole: "TERCERO", side: "NEUTRAL", displayName: "Workers' Comp Insurer", displayNameEs: "ART" },
  
  // Judicial/Prosecution
  "JUEZ": { localRole: "JUEZ", side: "JUDICIAL", displayName: "Judge", displayNameEs: "Juez" },
  "JUEZA": { localRole: "JUEZ", side: "JUDICIAL", displayName: "Judge", displayNameEs: "Jueza" },
  "MAGISTRADO": { localRole: "JUEZ", side: "JUDICIAL", displayName: "Magistrate", displayNameEs: "Magistrado" },
  "FISCAL": { localRole: "FISCAL", side: "JUDICIAL", displayName: "Prosecutor", displayNameEs: "Fiscal" },
  "FISCAL GENERAL": { localRole: "FISCAL", side: "JUDICIAL", displayName: "Attorney General", displayNameEs: "Fiscal General" },
  "MINISTERIO PUBLICO": { localRole: "FISCAL", side: "JUDICIAL", displayName: "Public Ministry", displayNameEs: "Ministerio Público" },
  "MINISTERIO PUBLICO FISCAL": { localRole: "FISCAL", side: "JUDICIAL", displayName: "Public Prosecutor's Office", displayNameEs: "Ministerio Público Fiscal" },
  
  // Experts and witnesses
  "PERITO": { localRole: "PERITO", side: "NEUTRAL", displayName: "Expert Witness", displayNameEs: "Perito" },
  "PERITO MEDICO": { localRole: "PERITO", side: "NEUTRAL", displayName: "Medical Expert", displayNameEs: "Perito Médico" },
  "PERITO CONTADOR": { localRole: "PERITO", side: "NEUTRAL", displayName: "Accounting Expert", displayNameEs: "Perito Contador" },
  "PERITO CALIGRAFO": { localRole: "PERITO", side: "NEUTRAL", displayName: "Handwriting Expert", displayNameEs: "Perito Calígrafo" },
  "TESTIGO": { localRole: "TESTIGO", side: "NEUTRAL", displayName: "Witness", displayNameEs: "Testigo" },
  
  // Generic attorneys (when side is unclear)
  "ABOGADO": { localRole: "OTRO", side: "NEUTRAL", displayName: "Attorney", displayNameEs: "Abogado" },
  "ABOGADA": { localRole: "OTRO", side: "NEUTRAL", displayName: "Attorney", displayNameEs: "Abogada" },
  "LETRADO": { localRole: "OTRO", side: "NEUTRAL", displayName: "Lawyer", displayNameEs: "Letrado" },
  "APODERADO": { localRole: "OTRO", side: "NEUTRAL", displayName: "Representative", displayNameEs: "Apoderado" },
  "PATROCINANTE": { localRole: "OTRO", side: "NEUTRAL", displayName: "Sponsoring Attorney", displayNameEs: "Patrocinante" },
};

/**
 * Default mapping for unknown roles
 */
export const DEFAULT_ROLE_MAPPING: RoleMapping = {
  localRole: "OTRO",
  side: "NEUTRAL",
  displayName: "Other",
  displayNameEs: "Otro",
};

/**
 * Get the local role mapping for a PJN role string.
 * Normalizes the input and looks up in the mapping table.
 * 
 * @param pjnRole - The raw PJN role string
 * @returns The role mapping, or default if not found
 */
export function mapPjnRole(pjnRole: string): RoleMapping & { rawRole: string } {
  const normalizedRole = pjnRole.trim().toUpperCase();
  const mapping = PJN_ROLE_MAPPING[normalizedRole] || DEFAULT_ROLE_MAPPING;
  return {
    ...mapping,
    rawRole: pjnRole,
  };
}

/**
 * Get all roles that belong to a specific side.
 */
export function getRolesBySide(side: RoleSide): string[] {
  return Object.entries(PJN_ROLE_MAPPING)
    .filter(([_, mapping]) => mapping.side === side)
    .map(([role]) => role);
}

/**
 * Check if a role is a party role (actor or demandado, not attorney)
 */
export function isPartyRole(localRole: LocalRole): boolean {
  return ["ACTOR", "DEMANDADO", "QUERELLANTE", "IMPUTADO", "TERCERO"].includes(localRole);
}

/**
 * Check if a role is an attorney role
 */
export function isAttorneyRole(localRole: LocalRole): boolean {
  return ["ABOGADO_ACTOR", "ABOGADO_DEMANDADO", "DEFENSOR"].includes(localRole);
}

/**
 * Check if a role is judicial (judge, prosecutor)
 */
export function isJudicialRole(localRole: LocalRole): boolean {
  return ["JUEZ", "FISCAL"].includes(localRole);
}
