/**
 * Client Validators
 *
 * Convex validators for client-related types.
 * Extracted from clients.ts for better code organization.
 */

import { v } from "convex/values";

// ========================================
// CLIENT VALIDATOR
// ========================================

/**
 * Validator reutilizable para el cliente con nuevo modelo jurídico.
 * displayName es string porque siempre lo calculamos en el handler.
 */
export const clientValidator = v.object({
  _id: v.id("clients"),
  _creationTime: v.number(),
  // Capa 1 - Naturaleza Jurídica
  naturalezaJuridica: v.union(v.literal("humana"), v.literal("juridica")),
  // Campos Persona Humana
  nombre: v.optional(v.string()),
  apellido: v.optional(v.string()),
  dni: v.optional(v.string()),
  actividadEconomica: v.optional(
    v.union(
      v.literal("sin_actividad"),
      v.literal("profesional"),
      v.literal("comerciante"),
    ),
  ),
  profesionEspecifica: v.optional(v.string()),
  // Campos Persona Jurídica
  razonSocial: v.optional(v.string()),
  tipoPersonaJuridica: v.optional(
    v.union(
      v.literal("sociedad"),
      v.literal("asociacion_civil"),
      v.literal("fundacion"),
      v.literal("cooperativa"),
      v.literal("ente_publico"),
      v.literal("consorcio"),
      v.literal("otro"),
    ),
  ),
  tipoSociedad: v.optional(
    v.union(
      v.literal("SA"),
      v.literal("SAS"),
      v.literal("SRL"),
      v.literal("COLECTIVA"),
      v.literal("COMANDITA_SIMPLE"),
      v.literal("COMANDITA_ACCIONES"),
      v.literal("CAPITAL_INDUSTRIA"),
      v.literal("IRREGULAR"),
      v.literal("HECHO"),
      v.literal("OTRO"),
    ),
  ),
  descripcionOtro: v.optional(v.string()),
  // Campos comunes
  cuit: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  domicilioLegal: v.optional(v.string()),
  notes: v.optional(v.string()),
  displayName: v.string(),
  // Campos legado (ya no funca esto)
  clientType: v.optional(
    v.union(v.literal("individual"), v.literal("company")),
  ),
  name: v.optional(v.string()),
  address: v.optional(v.string()),
  // Sistema
  isActive: v.boolean(),
  createdBy: v.id("users"),
});

// ========================================
// CLIENT CASE VALIDATOR
// ========================================

/**
 * Validator para casos asociados a un cliente.
 */
export const clientCaseValidator = v.object({
  case: v.union(
    v.object({
      _id: v.id("cases"),
      _creationTime: v.number(),
      title: v.string(),
      description: v.optional(v.string()),
      status: v.union(
        v.literal("pendiente"),
        v.literal("en progreso"),
        v.literal("completado"),
        v.literal("archivado"),
        v.literal("cancelado"),
      ),
      category: v.optional(v.string()),
      priority: v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
      ),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      assignedLawyer: v.id("users"),
      createdBy: v.id("users"),
      isArchived: v.boolean(),
      tags: v.optional(v.array(v.string())),
      estimatedHours: v.optional(v.number()),
      actualHours: v.optional(v.number()),
      expedientNumber: v.optional(v.string()),
      fre: v.optional(v.string()),
      lastActivityAt: v.optional(v.number()),
      lastPjnHistorySyncAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  role: v.optional(v.string()),
  relationId: v.id("clientCases"),
});
