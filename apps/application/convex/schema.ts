import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { stripeTables } from "@raideno/convex-stripe/server";

// Define granular permission types matching frontend constants
const granularPermissionType = v.union(
  // Case-level permissions
  v.literal("case.view"),
  v.literal("case.edit"),
  v.literal("case.delete"),

  // Document permissions
  v.literal("documents.read"),
  v.literal("documents.write"),
  v.literal("documents.delete"),

  // Escrito permissions
  v.literal("escritos.read"),
  v.literal("escritos.write"),
  v.literal("escritos.delete"),

  // Client permissions
  v.literal("clients.read"),
  v.literal("clients.write"),
  v.literal("clients.delete"),

  // Team permissions
  v.literal("teams.read"),
  v.literal("teams.write"),

  // Chat permissions
  v.literal("chat.access"),

  // Full access
  v.literal("full"),
);

export default defineSchema({
  ...stripeTables,
  // Users table - for authentication and user management
  users: defineTable({
    // Clerk integration
    clerkId: v.string(), // Clerk user ID for auth

    // Basic user info
    name: v.string(),
    email: v.string(),
    isActive: v.boolean(),
    profileImage: v.optional(v.id("_storage")),
    role: v.optional(v.string()),

    // Onboarding and profile completion
    isOnboardingComplete: v.boolean(),
    onboardingStep: v.optional(v.number()), // Track current onboarding step

    // Extended profile information (collected during onboarding)
    specializations: v.optional(v.array(v.string())), // Legal specializations
    barNumber: v.optional(v.string()), // Bar registration number
    hasDespacho: v.optional(v.boolean()), // Whether user works at a law firm
    firmName: v.optional(v.string()), // Law firm name
    workLocation: v.optional(v.string()), // Work location/city
    experienceYears: v.optional(v.number()), // Years of experience
    bio: v.optional(v.string()), // Professional biography // Date of migration from another platform

    // Trial tracking
    trialStatus: v.optional(
      v.union(
        v.literal("active"), // Currently in trial
        v.literal("expired"), // Trial ended, no conversion
        v.literal("converted"), // Upgraded to paid
        v.literal("none"), // Never had trial
      ),
    ),
    trialStartDate: v.optional(v.number()),
    trialEndDate: v.optional(v.number()),
    trialPlan: v.optional(
      v.union(v.literal("premium_individual"), v.literal("premium_team")),
    ),
    hasUsedTrial: v.optional(v.boolean()), // Prevents re-use (default false for existing users)

    // User preferences
    preferences: v.optional(
      v.object({
        // General
        language: v.string(),
        timezone: v.string(),

        // Notifications
        emailNotifications: v.boolean(),
        caseUpdates: v.optional(v.boolean()),
        documentProcessing: v.optional(v.boolean()),
        teamInvitations: v.optional(v.boolean()),
        agentResponses: v.optional(v.boolean()),
        eventReminders: v.optional(v.boolean()),
        eventUpdates: v.optional(v.boolean()),

        // Agent Preferences
        agentResponseStyle: v.optional(v.string()),
        defaultJurisdiction: v.optional(v.string()),
        autoIncludeContext: v.optional(v.boolean()),
        citationFormat: v.optional(v.string()),
        doctrineSearchSites: v.optional(v.array(v.string())),

        // Privacy & Security
        sessionTimeout: v.optional(v.number()),
        activityLogVisible: v.optional(v.boolean()),

        // WhatsApp
        whatsappNumber: v.optional(v.string()),
        whatsappVerified: v.optional(v.boolean()),
      }),
    ),
    migration: v.optional(
      v.object({
        status: v.union(
          v.literal("pending"),
          v.literal("in_progress"),
          v.literal("completed"),
          v.literal("failed"),
        ),
        oldKindeId: v.string(),
        consentGiven: v.boolean(),
      }),
    ),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_active_status", ["isActive"])
    .index("by_onboarding_status", ["isOnboardingComplete"])
    .index("by_trial_status", ["trialStatus"])
    .index("by_trial_end_date", ["trialEndDate"])
    .index("by_email_trial", ["email", "hasUsedTrial"]),

  // Tutorial Progress - tracks user's progress through the tutorial
  tutorialProgress: defineTable({
    userId: v.id("users"),

    // Overall tutorial state
    isActive: v.boolean(), // Whether tutorial is currently showing
    isCompleted: v.boolean(), // Whether user has finished the entire tutorial

    // Current position
    currentPage: v.optional(v.string()), // e.g., "home", "cases", "case-detail"
    currentStepId: v.optional(v.string()), // ID of the current step

    // Progress tracking
    completedSteps: v.array(v.string()), // Array of completed step IDs
    skippedPages: v.array(v.string()), // Pages user chose to skip

    // Metadata
    startedAt: v.number(),
    lastUpdatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_active_status", ["isActive"])
    .index("by_completion_status", ["isCompleted"]),

  // Clients table - legal clients (modelo jurídico CCyCN + LGS)
  clients: defineTable({
    // ============================================
    // CAPA 1 - NATURALEZA JURÍDICA
    // Opcional para compatibilidad con datos legacy - las funciones calculan fallback
    // ============================================
    naturalezaJuridica: v.optional(
      v.union(
        v.literal("humana"), // Persona humana (Art. 19 CCyCN)
        v.literal("juridica"), // Persona jurídica (Art. 141 CCyCN)
      ),
    ),

    // ============================================
    // CAMPOS PERSONA HUMANA (naturalezaJuridica = "humana")
    // ============================================
    nombre: v.optional(v.string()), // Nombre de pila
    apellido: v.optional(v.string()), // Apellido
    dni: v.optional(v.string()), // DNI (obligatorio para persona humana)

    // Clasificación económica (persona humana)
    actividadEconomica: v.optional(
      v.union(
        v.literal("sin_actividad"), // Consumidor puro
        v.literal("profesional"), // Profesional independiente
        v.literal("comerciante"), // Comerciante individual
      ),
    ),
    profesionEspecifica: v.optional(v.string()), // Si es profesional o comerciante

    // ============================================
    // CAMPOS PERSONA JURÍDICA (naturalezaJuridica = "juridica")
    // ============================================
    razonSocial: v.optional(v.string()), // Razón social (obligatorio para PJ)

    // Tipo de persona jurídica (Art. 148 CCyCN)
    tipoPersonaJuridica: v.optional(
      v.union(
        v.literal("sociedad"), // Sociedades comerciales (LGS)
        v.literal("asociacion_civil"), // Asociación Civil
        v.literal("fundacion"), // Fundación
        v.literal("cooperativa"), // Cooperativa
        v.literal("ente_publico"), // Entes estatales
        v.literal("consorcio"), // Consorcio de PH
        v.literal("otro"), // Otros tipos
      ),
    ),

    // Tipo societario (solo si tipoPersonaJuridica = "sociedad")
    tipoSociedad: v.optional(
      v.union(
        v.literal("SA"), // Sociedad Anónima
        v.literal("SAS"), // Sociedad por Acciones Simplificada
        v.literal("SRL"), // Sociedad de Responsabilidad Limitada
        v.literal("COLECTIVA"), // Sociedad Colectiva
        v.literal("COMANDITA_SIMPLE"), // Sociedad en Comandita Simple
        v.literal("COMANDITA_ACCIONES"), // Sociedad en Comandita por Acciones
        v.literal("CAPITAL_INDUSTRIA"), // Sociedad de Capital e Industria
        v.literal("IRREGULAR"), // Sociedad irregular ⚠️
        v.literal("HECHO"), // Sociedad de hecho ⚠️
        v.literal("OTRO"), // Otro tipo
      ),
    ),

    // Descripción para tipos "otro"
    descripcionOtro: v.optional(v.string()),

    // ============================================
    // CAMPOS COMUNES
    // ============================================
    cuit: v.optional(v.string()), // CUIT (obligatorio para PJ, condicional para PH)
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    domicilioLegal: v.optional(v.string()),
    notes: v.optional(v.string()),

    // Campo computado para display y búsquedas (nombre completo o razón social)
    // Opcional para compatibilidad con datos legacy - las funciones calculan fallback
    displayName: v.optional(v.string()),

    // ============================================
    // CAMPOS LEGADO (para migración - deprecated)
    // ============================================
    // @deprecated - usar naturalezaJuridica
    clientType: v.optional(
      v.union(v.literal("individual"), v.literal("company")),
    ),
    // @deprecated - usar displayName
    name: v.optional(v.string()),
    // @deprecated - usar domicilioLegal
    address: v.optional(v.string()),

    // ============================================
    // SISTEMA
    // ============================================
    isActive: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_naturaleza", ["naturalezaJuridica"])
    .index("by_dni", ["dni"])
    .index("by_cuit", ["cuit"])
    .index("by_email", ["email"])
    .index("by_created_by", ["createdBy"])
    .index("by_active_status", ["isActive"])
    .index("by_tipo_persona_juridica", ["tipoPersonaJuridica"])
    .index("by_tipo_sociedad", ["tipoSociedad"])
    .searchIndex("search_clients", {
      searchField: "displayName",
      filterFields: ["isActive", "naturalezaJuridica"],
    }),

  // Cases table - legal cases (removed clientId for many-to-many relationship)
  cases: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    expedientNumber: v.optional(v.string()), // Número de expediente judicial
    // PJN identifier for linking cases to portal notifications.
    // Format: "JURISDICTION-NUMBER" (e.g., "FRE-3852/2020/TO2", "CSJ-1234/2021")
    // Note: Portal uses space separator, we normalize to hyphen for storage.
    fre: v.optional(v.string()),
    status: v.union(
      v.literal("pendiente"),
      v.literal("en progreso"),
      v.literal("completado"),
      v.literal("archivado"),
      v.literal("cancelado"),
    ),
    category: v.optional(v.string()), // e.g., "Derecho Civil", "Derecho Mercantil"
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    assignedLawyer: v.id("users"),
    createdBy: v.id("users"),
    isArchived: v.boolean(),
    tags: v.optional(v.array(v.string())),
    estimatedHours: v.optional(v.number()),
    actualHours: v.optional(v.number()),
    lastActivityAt: v.optional(v.number()),
    lastPjnNotificationSync: v.optional(v.number()), // Last sync timestamp for PJN notifications
  })
    .index("by_status", ["status"])
    .index("by_assigned_lawyer", ["assignedLawyer"])
    .index("by_created_by", ["createdBy"])
    .index("by_archived_status", ["isArchived"])
    .index("by_priority", ["priority"])
    .index("by_last_activity", ["lastActivityAt"])
    .index("by_fre", ["fre"])
    .searchIndex("search_cases", {
      searchField: "title",
      filterFields: ["isArchived"],
    }),

  // Client-Case relationship (many-to-many)
  clientCases: defineTable({
    clientId: v.id("clients"),
    caseId: v.id("cases"),
    role: v.optional(v.string()), // e.g., "plaintiff", "defendant", "witness"
    addedBy: v.id("users"),
    isActive: v.boolean(),
  })
    .index("by_client", ["clientId"])
    .index("by_case", ["caseId"])
    .index("by_client_and_case", ["clientId", "caseId"])
    .index("by_added_by", ["addedBy"])
    .index("by_active_status", ["isActive"]),

  // Folders table - organizational folders
  folders: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    caseId: v.id("cases"),
    parentFolderId: v.optional(v.id("folders")), // subfolder support
    color: v.optional(v.string()), // color optional for ui
    isArchived: v.boolean(),
    createdBy: v.id("users"),
    sortOrder: v.optional(v.number()),
  })
    .index("by_case", ["caseId"])
    .index("by_parent", ["parentFolderId"])
    .index("by_case_and_parent", ["caseId", "parentFolderId"])
    .index("by_created_by", ["createdBy"])
    .index("by_archived_status", ["isArchived"]),

  // Documents table - file-based documents stored in Convex storage or GCS
  documents: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    caseId: v.id("cases"),
    folderId: v.optional(v.id("folders")),
    documentType: v.optional(
      v.union(
        v.literal("contract"),
        v.literal("evidence"),
        v.literal("correspondence"),
        v.literal("legal_brief"),
        v.literal("court_filing"),
        v.literal("other"),
      ),
    ),
    // Convex storage file id (legacy/backward compatible)
    fileId: v.optional(v.id("_storage")),
    // GCS metadata (new path)
    storageBackend: v.optional(v.union(v.literal("convex"), v.literal("gcs"))),
    gcsBucket: v.optional(v.string()),
    gcsObject: v.optional(v.string()),
    originalFileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    createdBy: v.id("users"),
    tags: v.optional(v.array(v.string())),
    // Processing status fields
    processingStatus: v.optional(
      v.union(
        v.literal("pending"), // Document uploaded, waiting to be processed
        v.literal("processing"), // Currently being chunked and embedded
        v.literal("completed"), // Successfully processed with chunks
        v.literal("failed"), // Processing failed
      ),
    ),
    processingStartedAt: v.optional(v.number()),
    processingCompletedAt: v.optional(v.number()),
    processingError: v.optional(v.string()),
    totalChunks: v.optional(v.number()), // Number of chunks created
    // Retry tracking
    retryCount: v.optional(v.number()),
    lastRetryAt: v.optional(v.number()),
    // Progress tracking
    processingPhase: v.optional(
      v.union(
        v.literal("downloading"),
        v.literal("extracting"),
        v.literal("chunking"),
        v.literal("embedding"),
        v.literal("upserting"),
      ),
    ),
    processingProgress: v.optional(v.number()), // 0-100
    // Error categorization
    processingErrorType: v.optional(v.string()),
    processingErrorRecoverable: v.optional(v.boolean()),
    // Processing metadata
    processingMethod: v.optional(v.string()), // "mistral-ocr", "pdfjs", "transcription"
    wasResumed: v.optional(v.boolean()),
    processingDurationMs: v.optional(v.number()),
    // Extracted text fields (for transcriptions, OCR, etc.)
    extractedText: v.optional(v.string()), // Full transcript or OCR text
    extractedTextLength: v.optional(v.number()), // Character count for validation
    transcriptionConfidence: v.optional(v.number()), // Deepgram confidence score
    transcriptionDuration: v.optional(v.number()), // Audio/video duration in seconds
    transcriptionModel: v.optional(v.string()), // e.g., "nova-3"
  })
    .index("by_case", ["caseId"])
    .index("by_folder", ["folderId"])
    .index("by_case_and_folder", ["caseId", "folderId"])
    .index("by_type", ["documentType"])
    .index("by_created_by", ["createdBy"])
    .index("by_file_id", ["fileId"])
    .index("by_gcs_object", ["gcsObject"])
    .index("by_processing_status", ["processingStatus"])
    .searchIndex("search_documents", {
      searchField: "title",
    }),

  // Escritos table - Tiptap JSON documents (legal writings/briefs)
  // Simplified: removed parentEscritoId (no version control)
  escritos: defineTable({
    title: v.string(),
    prosemirrorId: v.string(), // Required Tiptap JSON content
    caseId: v.id("cases"),
    status: v.union(v.literal("borrador"), v.literal("terminado")),
    presentationDate: v.optional(v.number()),
    courtName: v.optional(v.string()),
    expedientNumber: v.optional(v.string()),
    wordCount: v.optional(v.number()),
    lastEditedAt: v.number(),
    createdBy: v.id("users"),
    lastModifiedBy: v.id("users"),
    isArchived: v.boolean(),
  })
    .index("by_case", ["caseId"])
    .index("by_status", ["status"])
    .index("by_created_by", ["createdBy"])
    .index("by_archived_status", ["isArchived"])
    .index("by_presentation_date", ["presentationDate"])
    .index("by_last_edited", ["lastEditedAt"])
    .index("by_prosemirror_id", ["prosemirrorId"])
    .searchIndex("search_escritos", {
      searchField: "title",
      filterFields: ["isArchived"],
    }),

  // Document Templates (Modelos) - independent reusable templates
  modelos: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(), // e.g., "Derecho Civil", "Derecho Mercantil"
    templateType: v.optional(
      v.union(
        v.literal("escrito"), // Tiptap JSON template for escritos
        v.literal("document"), // File-based template for documents
      ),
    ),
    // Legacy fields for backward compatibility
    content: v.optional(v.string()), // Legacy HTML content field
    content_type: v.optional(v.string()), // Legacy content type field
    // For escrito templates (Tiptap JSON)
    prosemirrorId: v.optional(v.string()), // Tiptap JSON template content
    mimeType: v.optional(v.string()),
    originalFileName: v.optional(v.string()),
    isPublic: v.boolean(), // False = only team can access, True = anyone can access
    createdBy: v.union(v.id("users"), v.literal("system")), // Allow system templates
    tags: v.optional(v.array(v.string())),
    usageCount: v.number(), // Number of times this template has been used
    isActive: v.boolean(),
  })
    .index("by_category", ["category"])
    .index("by_type", ["templateType"])
    .index("by_created_by", ["createdBy"])
    .index("by_public_status", ["isPublic"])
    .index("by_active_status", ["isActive"])
    .searchIndex("search_templates", {
      searchField: "name",
      filterFields: ["category", "isPublic", "isActive"],
    }),

  // Prompts Library - Prompt templates for AI agent interactions
  prompts: defineTable({
    titulo: v.string(),
    category: v.string(), // e.g., "Civil", "Penal", "Laboral"
    descripcion: v.string(), // Short description of what the prompt does
    prompt: v.string(), // The actual prompt text with [placeholders]
    isPublic: v.boolean(), // False = only team can access, True = anyone can access
    createdBy: v.union(v.id("users"), v.literal("system")), // Allow system prompts
    tags: v.optional(v.array(v.string())),
    usageCount: v.number(), // Number of times this prompt has been used
    isActive: v.boolean(),
    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_created_by", ["createdBy"])
    .index("by_public_status", ["isPublic"])
    .index("by_active_status", ["isActive"])
    .searchIndex("search_prompts", {
      searchField: "titulo",
      filterFields: ["category", "isPublic", "isActive"],
    }),

  // Teams - organizational teams/departments for firm management
  teams: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    teamLead: v.optional(v.id("users")),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_team_lead", ["teamLead"])
    .index("by_active_status", ["isActive"])
    .index("by_created_by", ["createdBy"]),

  // Team Membership - many-to-many relationship between users and teams
  teamMemberships: defineTable({
    teamId: v.id("teams"),
    userId: v.id("users"),
    role: v.union(
      v.literal("secretario"),
      v.literal("abogado"),
      v.literal("admin"),
    ),
    joinedAt: v.number(),
    addedBy: v.id("users"),
    isActive: v.boolean(),
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"])
    .index("by_team_and_user", ["teamId", "userId"])
    .index("by_role", ["role"])
    .index("by_active_status", ["isActive"]),

  // Team Case Access - team-based case permissions
  teamCaseAccess: defineTable({
    caseId: v.id("cases"),
    teamId: v.id("teams"),
    accessLevel: v.union(
      v.literal("full"), // Full access - can see and edit everything
      v.literal("read"), // Read-only access - can only view
    ),
    grantedBy: v.id("users"),
    isActive: v.boolean(),
  })
    .index("by_case", ["caseId"])
    .index("by_team", ["teamId"])
    .index("by_case_and_team", ["caseId", "teamId"])
    .index("by_access_level", ["accessLevel"])
    .index("by_granted_by", ["grantedBy"])
    .index("by_active_status", ["isActive"]),

  // User Case Access - individual user permissions for cases
  userCaseAccess: defineTable({
    caseId: v.id("cases"),
    userId: v.id("users"),
    permissions: v.array(granularPermissionType),
    grantedBy: v.id("users"),
    grantedAt: v.number(),
    expiresAt: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_user_and_case", ["userId", "caseId"])
    .index("by_case", ["caseId"])
    .index("by_user", ["userId"])
    .index("by_active_status", ["isActive"])
    .index("by_expires_at", ["expiresAt"]),

  // Team Member Case Access - granular permissions for team members on specific cases
  teamMemberCaseAccess: defineTable({
    caseId: v.id("cases"),
    teamId: v.id("teams"),
    userId: v.id("users"),
    permissions: v.array(granularPermissionType),
    grantedBy: v.id("users"),
    grantedAt: v.number(),
    expiresAt: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_team_and_case", ["teamId", "caseId"])
    .index("by_user_and_case", ["userId", "caseId"])
    .index("by_team_user_case", ["teamId", "userId", "caseId"])
    .index("by_case", ["caseId"])
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"])
    .index("by_active_status", ["isActive"]),

  // Team Invitations - manages team invitations via email
  teamInvites: defineTable({
    teamId: v.id("teams"),
    email: v.string(),
    invitedBy: v.id("users"),
    token: v.string(), // Unique invitation token
    role: v.union(
      v.literal("secretario"),
      v.literal("abogado"),
      v.literal("admin"),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired"),
      v.literal("cancelled"),
    ),
    expiresAt: v.number(), // Timestamp when invitation expires
    acceptedAt: v.optional(v.number()),
    acceptedBy: v.optional(v.id("users")),
  })
    .index("by_team", ["teamId"])
    .index("by_email", ["email"])
    .index("by_token", ["token"])
    .index("by_status", ["status"])
    .index("by_invited_by", ["invitedBy"])
    .index("by_team_and_email", ["teamId", "email"])
    .index("by_expires_at", ["expiresAt"]),

  // ========================================
  // TODO PLANNING & TRACKING (Phase 1)
  // ========================================

  // Todo Lists: High-level containers for tasks, optionally tied to a case and/or agent thread
  todoLists: defineTable({
    title: v.string(),
    createdBy: v.id("users"),
    caseId: v.optional(v.id("cases")),
    // Agent thread id (from @convex-dev/agent threads). Stored as string.
    threadId: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("archived"),
      ),
    ),
    isActive: v.boolean(),
    // Optional cached progress percent (0-100). Can be derived in queries.
    progressPercent: v.optional(v.number()),
  })
    .index("by_created_by", ["createdBy"])
    .index("by_case", ["caseId"])
    .index("by_thread", ["threadId"])
    .index("by_status", ["status"])
    .index("by_active", ["isActive"]),

  // Todo Items: Individual tasks belonging to a list
  todoItems: defineTable({
    listId: v.id("todoLists"),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("blocked"),
    ),
    order: v.number(),
    assignedTo: v.optional(v.id("users")),
    dueDate: v.optional(v.number()),
    blockedReason: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_list", ["listId"])
    .index("by_status", ["status"])
    .index("by_list_and_status", ["listId", "status"])
    .index("by_assigned_to", ["assignedTo"]),

  // ========================================
  // NEW UNIFIED PERMISSIONS SYSTEM
  // ========================================

  // Unified Case Access - NEW simplified 3-level system
  // This will gradually replace userCaseAccess, teamCaseAccess, teamMemberCaseAccess
  caseAccess: defineTable({
    caseId: v.id("cases"),
    // Either userId OR teamId should be set, not both
    userId: v.optional(v.id("users")), // Individual user access
    teamId: v.optional(v.id("teams")), // Team-based access
    accessLevel: v.union(
      v.literal("none"),
      v.literal("basic"), // View documents, use agent
      v.literal("advanced"), // Edit documents, manage case data
      v.literal("admin"), // Manage permissions, full control
    ),
    grantedBy: v.id("users"),
    grantedAt: v.number(),
    expiresAt: v.optional(v.number()),
    isActive: v.boolean(),
    // Optional notes for why access was granted
    notes: v.optional(v.string()),
  })
    .index("by_case", ["caseId"])
    .index("by_user", ["userId"])
    .index("by_team", ["teamId"])
    .index("by_case_and_user", ["caseId", "userId"])
    .index("by_case_and_team", ["caseId", "teamId"])
    .index("by_access_level", ["accessLevel"])
    .index("by_granted_by", ["grantedBy"])
    .index("by_active_status", ["isActive"])
    .index("by_expires_at", ["expiresAt"]),

  // ========================================
  // LIBRARY - DOCUMENTS AND FOLDERS
  // ========================================

  libraryFolders: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    // Either userId (personal) OR teamId (team library)
    userId: v.optional(v.id("users")),
    teamId: v.optional(v.id("teams")),
    parentFolderId: v.optional(v.id("libraryFolders")),
    color: v.optional(v.string()),
    isArchived: v.boolean(),
    createdBy: v.id("users"),
    sortOrder: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_team", ["teamId"])
    .index("by_parent", ["parentFolderId"])
    .index("by_active_status", ["isArchived"])
    .index("by_created_by", ["createdBy"])
    .index("by_sort_order", ["sortOrder"]),

  // Library Documents - files stored in Convex storage or GCS
  libraryDocuments: defineTable({
    title: v.string(),
    userId: v.optional(v.id("users")),
    teamId: v.optional(v.id("teams")),
    description: v.optional(v.string()),
    folderId: v.optional(v.id("libraryFolders")),
    createdBy: v.id("users"),
    gcsBucket: v.optional(v.string()),
    gcsObject: v.optional(v.string()),
    mimeType: v.string(),
    fileSize: v.number(),
    tags: v.optional(v.array(v.string())),
    processingStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed"),
      ),
    ),
    // Add these missing processing fields:
    processingStartedAt: v.optional(v.number()),
    processingCompletedAt: v.optional(v.number()),
    processingError: v.optional(v.string()),
    totalChunks: v.optional(v.number()), // Number of chunks created
    // Retry tracking
    retryCount: v.optional(v.number()),
    lastRetryAt: v.optional(v.number()),
    // Progress tracking
    processingPhase: v.optional(
      v.union(
        v.literal("downloading"),
        v.literal("extracting"),
        v.literal("chunking"),
        v.literal("embedding"),
        v.literal("upserting"),
      ),
    ),
    processingProgress: v.optional(v.number()), // 0-100
    // Error categorization
    processingErrorType: v.optional(v.string()),
    processingErrorRecoverable: v.optional(v.boolean()),
    // Processing metadata
    processingMethod: v.optional(v.string()), // "mistral-ocr", "pdfjs", "transcription"
    wasResumed: v.optional(v.boolean()),
    processingDurationMs: v.optional(v.number()),
    // Extracted text fields (for transcriptions, OCR, etc.)
    extractedText: v.optional(v.string()), // Full transcript or OCR text
    extractedTextLength: v.optional(v.number()), // Character count for validation
    transcriptionConfidence: v.optional(v.number()), // Deepgram confidence score
    transcriptionDuration: v.optional(v.number()), // Audio/video duration in seconds
    transcriptionModel: v.optional(v.string()), // e.g., "nova-3"
  })
    .index("by_user", ["userId"])
    .index("by_team", ["teamId"])
    .index("by_folder", ["folderId"])
    .index("by_type", ["mimeType"])
    .index("by_created_by", ["createdBy"])
    .index("by_gcs_object", ["gcsObject"])
    .index("by_processing_status", ["processingStatus"])
    .searchIndex("search_library_documents", {
      searchField: "title",
    }),

  // ========================================
  // AGENT RULES - USER & CASE SCOPED
  // ========================================
  agentRules: defineTable({
    name: v.string(),
    content: v.string(),
    scope: v.union(v.literal("user"), v.literal("case")),
    userId: v.optional(v.id("users")),
    caseId: v.optional(v.id("cases")),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    order: v.optional(v.number()),
  })
    .index("by_user_and_active", ["userId", "isActive"])
    .index("by_case_and_active", ["caseId", "isActive"])
    .index("by_scope", ["scope"])
    .index("by_created_by", ["createdBy"]),

  usageLimits: defineTable({
    entityId: v.string(), // userId o teamId

    entityType: v.union(v.literal("user"), v.literal("team")),

    // Contadores

    casesCount: v.number(),

    documentsCount: v.number(),

    aiMessagesThisMonth: v.number(),

    escritosCount: v.number(),

    libraryDocumentsCount: v.number(),

    storageUsedBytes: v.number(),

    // Control de reset mensual

    lastResetDate: v.number(),

    currentMonthStart: v.number(),
  })
    .index("by_entity", ["entityId"])

    .index("by_entity_type", ["entityType"]),

  aiCreditPurchases: defineTable({
    userId: v.id("users"),

    stripeInvoiceId: v.string(),

    creditsAmount: v.number(),

    priceUSD: v.number(),

    status: v.union(
      v.literal("pending"),

      v.literal("completed"),

      v.literal("failed"),
    ),

    purchasedAt: v.number(),

    expiresAt: v.number(), // 90 días
  })
    .index("by_user", ["userId"])

    .index("by_stripe_invoice", ["stripeInvoiceId"])

    .index("by_status", ["status"]),

  aiCredits: defineTable({
    userId: v.id("users"),

    purchased: v.number(),

    used: v.number(),

    remaining: v.number(),

    expiresAt: v.optional(v.number()),

    lastUpdated: v.number(),
  }).index("by_user", ["userId"]),

  // ========================================
  // EVENTS & CALENDAR SYSTEM
  // ========================================

  events: defineTable({
    title: v.string(),
    description: v.optional(v.string()),

    caseId: v.optional(v.id("cases")), // Si existe → evento de caso
    teamId: v.optional(v.id("teams")), // Si existe → evento de equipo
    // Si ambos son null → evento personal

    eventType: v.union(
      // Eventos de caso
      v.literal("audiencia"),
      v.literal("plazo"),
      v.literal("reunion_cliente"),
      v.literal("presentacion"),

      // Eventos de equipo
      v.literal("reunion_equipo"),

      // Eventos personales
      v.literal("personal"),
      v.literal("otro"),
    ),

    // Fechas y tiempo
    startDate: v.number(),
    endDate: v.number(),
    allDay: v.boolean(),

    // Ubicación
    location: v.optional(v.string()),
    isVirtual: v.boolean(),
    meetingUrl: v.optional(v.string()), // Para despues esto va a servir

    // Recordatorios (minutos antes del evento)
    reminderMinutes: v.optional(v.array(v.number())), // [15, 60, 1440] = 15min, 1h, 1día

    // Estado
    status: v.union(
      v.literal("programado"),
      v.literal("completado"),
      v.literal("cancelado"),
      v.literal("reprogramado"),
    ),

    // Metadata
    createdBy: v.id("users"),
    isArchived: v.boolean(),

    // Notas adicionales
    notes: v.optional(v.string()),
  })
    .index("by_case", ["caseId"])
    .index("by_team", ["teamId"])
    .index("by_created_by", ["createdBy"])
    .index("by_start_date", ["startDate"])
    .index("by_status", ["status"])
    .index("by_type", ["eventType"])
    .index("by_case_and_date", ["caseId", "startDate"])
    .index("by_team_and_date", ["teamId", "startDate"])
    .index("by_archived_status", ["isArchived"])
    .searchIndex("search_events", {
      searchField: "title",
      filterFields: ["isArchived", "status"],
    }),

  // Event Participants - Users invited to events
  eventParticipants: defineTable({
    eventId: v.id("events"),
    userId: v.id("users"),

    // Rol en el evento
    role: v.union(
      v.literal("organizador"),
      v.literal("participante"),
      v.literal("opcional"),
    ),

    // Estado de asistencia
    attendanceStatus: v.union(
      v.literal("pendiente"),
      v.literal("aceptado"),
      v.literal("rechazado"),
      v.literal("tentativo"),
    ),

    addedBy: v.id("users"),
    isActive: v.boolean(),
  })
    .index("by_event", ["eventId"])
    .index("by_user", ["userId"])
    .index("by_event_and_user", ["eventId", "userId"])
    .index("by_attendance_status", ["attendanceStatus"])
    .index("by_active_status", ["isActive"]),

  // Marketing / Informational Popups - configurable popups shown in the app
  popups: defineTable({
    key: v.string(), // Stable identifier (e.g. "blackfriday-2025")
    title: v.string(),
    subtitle: v.optional(v.string()),
    upperBody: v.optional(v.string()),
    body: v.string(),
    // Image stored in GCS
    imageGcsBucket: v.optional(v.string()),
    imageGcsObject: v.optional(v.string()),
    enabled: v.boolean(),
    template: v.union(
      v.literal("simple"),
      v.literal("promo"),
      v.literal("text_only"),
    ),
    audience: v.union(
      v.literal("all"),
      v.literal("free"),
      v.literal("trial"),
      v.literal("free_or_trial"),
      v.literal("premium"),
    ),

    // Promo template extras
    badgeText: v.optional(v.string()),

    // CTAs (max 2 on UI; schema doesn't enforce the cap)
    actions: v.optional(
      v.array(
        v.object({
          type: v.union(v.literal("link"), v.literal("billing")),
          label: v.string(),
          // type=link
          url: v.optional(v.string()),
          newTab: v.optional(v.boolean()),
          // type=billing
          billingMode: v.optional(
            v.union(
              v.literal("plans"),
              v.literal("checkout_individual"),
              v.literal("checkout_team"),
            ),
          ),
        }),
      ),
    ),

    // Scheduling window (Unix timestamps ms)
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),

    // Frequency controls
    showAfterDays: v.optional(v.number()),
    frequencyDays: v.optional(v.number()),
    maxImpressions: v.optional(v.number()),

    // Ordering
    priority: v.optional(v.number()),

    // Audit
    createdBy: v.optional(v.id("users")),
    updatedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_enabled", ["enabled"])
    .index("by_enabled_and_priority", ["enabled", "priority"]),

  // Per-user popup view tracking (replaces localStorage gating)
  popupViews: defineTable({
    popupId: v.id("popups"),
    userId: v.id("users"),
    impressions: v.number(),
    firstShownAt: v.number(),
    lastShownAt: v.number(),
    dismissedAt: v.optional(v.number()),
  })
    .index("by_popup_and_user", ["popupId", "userId"])
    .index("by_user", ["userId"]),

  // MercadoPago subscriptions - for manual management
  mercadopagoSubscriptions: defineTable({
    // User reference
    userId: v.id("users"),

    // MercadoPago data
    mpSubscriptionId: v.string(), // MercadoPago subscription ID
    mpCustomerId: v.string(), // MercadoPago customer ID

    // Subscription details
    plan: v.union(
      v.literal("premium_individual"),
      v.literal("premium_team"),
      v.literal("enterprise"),
    ),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("cancelled"),
      v.literal("expired"),
    ),

    // Billing info
    amount: v.number(), // Amount in cents (e.g., 30000 for $300.00)
    currency: v.string(), // e.g., "ARS" or "USD"
    billingCycle: v.union(v.literal("monthly"), v.literal("yearly")),

    // Dates
    startDate: v.number(), // Unix timestamp
    nextBillingDate: v.number(), // Unix timestamp
    endDate: v.optional(v.number()), // Unix timestamp (if cancelled)

    // Admin management
    lastUpdatedBy: v.id("users"), // Admin who last updated this
    notes: v.optional(v.string()), // Admin notes

    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_plan", ["plan"])
    .index("by_mp_subscription_id", ["mpSubscriptionId"])
    .index("by_next_billing", ["nextBillingDate"])
    .index("by_active_status", ["status", "nextBillingDate"]),

  // Subscription thank you emails tracking - prevents duplicate emails
  subscriptionEmailsSent: defineTable({
    subscriptionId: v.string(), // Stripe subscription ID
    userId: v.id("users"), // User who received the email
    sentAt: v.number(), // Unix timestamp when email was sent
  })
    .index("by_subscription", ["subscriptionId"])
    .index("by_user", ["userId"])
    .index("by_sent_date", ["sentAt"]),

  // ========================================
  // GOOGLE DRIVE INTEGRATION
  // ========================================

  // Google OAuth State Tokens - temporary tokens for OAuth flow
  googleOAuthStates: defineTable({
    state: v.string(), // OAuth state token
    userId: v.id("users"), // User initiating the OAuth flow
    createdAt: v.number(), // Timestamp when state was created
  })
    .index("by_state", ["state"])
    .index("by_user", ["userId"])
    .index("by_created_at", ["createdAt"]),

  // Google Accounts - stores OAuth tokens for Google Drive/Docs access
  googleAccounts: defineTable({
    userId: v.id("users"), // User who connected their Google account
    accessToken: v.string(), // Google OAuth access token
    refreshToken: v.optional(v.string()), // Google OAuth refresh token (for token renewal)
    expiryDate: v.optional(v.number()), // Timestamp when access token expires
    scope: v.string(), // OAuth scopes granted (comma-separated)
    tokenType: v.string(), // Usually "Bearer"
    createdAt: v.number(), // Timestamp when account was first connected
    updatedAt: v.number(), // Timestamp when tokens were last updated
  }).index("by_user", ["userId"]),

  // PJN Account - stores encrypted PJN credentials
  pjnAccounts: defineTable({
    userId: v.id("users"),
    username: v.string(),
    encryptedPassword: v.string(), // AES-256-GCM encrypted password
    iv: v.string(), // Initialization vector for decryption
    lastAuthAt: v.optional(v.number()), // Last successful authentication timestamp
    lastSyncedAt: v.optional(v.number()), // Last successful sync timestamp
    lastEventId: v.optional(v.string()), // Last processed PJN event ID
    sessionValid: v.optional(v.boolean()), // Whether session is currently valid
    needsReauth: v.optional(v.boolean()), // Flag if re-authentication is required
    syncErrors: v.optional(
      v.object({
        lastErrorAt: v.number(),
        lastErrorReason: v.string(),
        errorCount: v.number(),
      })
    ),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_active", ["isActive"])
    .index("by_needs_reauth", ["needsReauth"]),

  // PJN Activity Log - tracks PJN-specific activities and notifications
  pjnActivityLog: defineTable({
    userId: v.id("users"),
    caseId: v.optional(v.id("cases")),
    action: v.string(), // e.g., "pjn_notification_received", "pjn_docket_movement", etc.
    source: v.optional(v.string()), // e.g., "PJN-Portal", "internal", etc.
    pjnEventId: v.optional(v.string()), // PJN event ID if from PJN
    pjnMovementId: v.optional(v.string()), // PJN movement ID if from docket sync
    metadata: v.optional(v.any()), // Flexible metadata object
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_case", ["caseId"])
    .index("by_action", ["action"])
    .index("by_source", ["source"])
    .index("by_timestamp", ["timestamp"])
    .index("by_user_and_timestamp", ["userId", "timestamp"])
    .index("by_case_and_timestamp", ["caseId", "timestamp"]),

  // Notifications - user-facing notifications from PJN and system events
  notifications: defineTable({
    userId: v.id("users"),
    kind: v.string(),
    title: v.string(),
    bodyPreview: v.string(), // Short preview text for the notification
    source: v.string(),
    readAt: v.optional(v.number()), // Timestamp when notification was read
    // Optional references to related entities
    caseId: v.optional(v.id("cases")),
    documentId: v.optional(v.id("documents")),
    pjnEventId: v.optional(v.string()), // For PJN notifications
    // Link target for navigation (e.g., "/cases/123" or "/documents/456")
    linkTarget: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_createdAt", ["userId", "createdAt"])
    .index("by_user_and_readAt", ["userId", "readAt"])
    .index("by_user_and_kind", ["userId", "kind"])
    .index("by_case", ["caseId"])
    .index("by_pjnEventId", ["pjnEventId"]), // For idempotency checks
});
