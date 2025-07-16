import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table - for authentication and user management
  users: defineTable({
    // Clerk integration
    clerkId: v.string(), // Clerk user ID for auth
    
    // Basic user info
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("lawyer"), v.literal("assistant")),
    isActive: v.boolean(),
    profileImage: v.optional(v.id("_storage")),
    
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
    preferences: v.optional(v.object({
      language: v.string(),
      timezone: v.string(),
      notifications: v.boolean(),
    })),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"])
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
      v.literal("cancelado")
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

  // Documents table - file-based documents stored in Convex storage
  documents: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    caseId: v.id("cases"),
    documentType: v.optional(v.union(
      v.literal("contract"),
      v.literal("evidence"),
      v.literal("correspondence"),
      v.literal("legal_brief"),
      v.literal("court_filing"),
      v.literal("other")
    )),
    fileId: v.id("_storage"),
    originalFileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    createdBy: v.id("users"),
    tags: v.optional(v.array(v.string())),
  })
    .index("by_case", ["caseId"])
    .index("by_type", ["documentType"])
    .index("by_created_by", ["createdBy"])
    .index("by_file_id", ["fileId"]),

  // Escritos table - Tiptap JSON documents (legal writings/briefs)
  // Simplified: removed parentEscritoId (no version control)
  escritos: defineTable({
    title: v.string(),
    content: v.string(), // Required Tiptap JSON content
    caseId: v.id("cases"),
    status: v.union(
      v.literal("borrador"),
      v.literal("terminado")
    ),
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
      v.literal("document") // File-based template for documents
    ),
    // For escrito templates (Tiptap JSON)
    content: v.optional(v.string()), // Tiptap JSON template content
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

  // Chat Sessions - simplified to only associate with cases
  chatSessions: defineTable({
    caseId: v.optional(v.id("cases")), // Optional - can be case-specific or general
    userId: v.id("users"),
    title: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_case", ["caseId"])
    .index("by_user", ["userId"])
    .index("by_active_status", ["isActive"]),

  // Chat Messages - individual messages in chat sessions
  chatMessages: defineTable({
    sessionId: v.id("chatSessions"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    messageType: v.union(
      v.literal("text"),
      v.literal("document_analysis"),
      v.literal("template_suggestion"),
      v.literal("legal_advice")
    ),
    metadata: v.optional(v.string()),
  })
    .index("by_session", ["sessionId"])
    .index("by_role", ["role"]),

  // Activity Log - audit trail for actions
  activityLog: defineTable({
    entityType: v.union(
      v.literal("case"),
      v.literal("document"),
      v.literal("escrito"),
      v.literal("client"),
      v.literal("user")
    ),
    entityId: v.string(),
    action: v.union(
      v.literal("created"),
      v.literal("updated"),
      v.literal("deleted"),
      v.literal("viewed"),
      v.literal("shared"),
      v.literal("archived"),
      v.literal("restored")
    ),
    userId: v.id("users"),
    details: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_user", ["userId"])
    .index("by_action", ["action"]),

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
      v.literal("admin")
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
      v.literal("read")  // Read-only access - can only view
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

});
