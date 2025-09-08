import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
    firmName: v.optional(v.string()), // Law firm name
    workLocation: v.optional(v.string()), // Work location/city
    experienceYears: v.optional(v.number()), // Years of experience
    bio: v.optional(v.string()), // Professional biography

    // User preferences
    preferences: v.optional(
      v.object({
        language: v.string(),
        timezone: v.string(),
        notifications: v.boolean(),
      }),
    ),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_active_status", ["isActive"])
    .index("by_onboarding_status", ["isOnboardingComplete"]),

  // Clients table - legal clients
  clients: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    dni: v.optional(v.string()), // DNI for identification
    cuit: v.optional(v.string()), // CUIT for tax identification
    address: v.optional(v.string()),
    clientType: v.union(v.literal("individual"), v.literal("company")),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_dni", ["dni"])
    .index("by_cuit", ["cuit"])
    .index("by_email", ["email"])
    .index("by_created_by", ["createdBy"])
    .index("by_active_status", ["isActive"]),

  // Cases table - legal cases (removed clientId for many-to-many relationship)
  cases: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
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
  })
    .index("by_status", ["status"])
    .index("by_assigned_lawyer", ["assignedLawyer"])
    .index("by_created_by", ["createdBy"])
    .index("by_archived_status", ["isArchived"])
    .index("by_priority", ["priority"]),

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
  })
    .index("by_case", ["caseId"])
    .index("by_folder", ["folderId"])
    .index("by_case_and_folder", ["caseId", "folderId"])
    .index("by_type", ["documentType"])
    .index("by_created_by", ["createdBy"])
    .index("by_file_id", ["fileId"])
    .index("by_gcs_object", ["gcsObject"])
    .index("by_processing_status", ["processingStatus"]),

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
    .index("by_last_edited", ["lastEditedAt"]),

  // Document Templates (Modelos) - independent reusable templates
  modelos: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(), // e.g., "Derecho Civil", "Derecho Mercantil"
    templateType: v.union(
      v.literal("escrito"), // Tiptap JSON template for escritos
      v.literal("document"), // File-based template for documents
    ),
    // For escrito templates (Tiptap JSON)
    prosemirrorId: v.optional(v.string()), // Tiptap JSON template content
    mimeType: v.optional(v.string()),
    originalFileName: v.optional(v.string()),
    isPublic: v.boolean(), // False = only team can access, True = anyone can access
    createdBy: v.id("users"),
    tags: v.optional(v.array(v.string())),
    usageCount: v.number(), // Number of times this template has been used
    isActive: v.boolean(),
  })
    .index("by_category", ["category"])
    .index("by_type", ["templateType"])
    .index("by_created_by", ["createdBy"])
    .index("by_public_status", ["isPublic"])
    .index("by_active_status", ["isActive"]),

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
});
