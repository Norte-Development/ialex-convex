import { Id } from "../_generated/dataModel";

// Types for the Context Service
export interface ContextBundle {
  user: UserContext;
  case: CaseContext | null;
  clients: ClientContext[];
  currentView: ViewContext;
  recentActivity: ActivityContext[];
  rules: RuleContext[];
  metadata: ContextMetadata;
  caseDocuments: CaseDocumentContext[];
  resolvedReferences?: ResolvedReference[];
}

export interface ResolvedReference {
  type: "client" | "document" | "escrito" | "case";
  id: string;
  name: string;
  originalText: string;
}

export interface UserContext {
  id: Id<"users">;
  name: string;
  email: string;
  role?: string;
  specializations?: string[];
  firmName?: string;
  experienceYears?: number;
  teams?: TeamMembership[];
  preferences?: {
    agentResponseStyle?: string;
    defaultJurisdiction?: string;
    citationFormat?: string;
    language?: string;
  };
}

export interface TeamMembership {
  id: Id<"teams">;
  name: string;
  role: string;
  joinedAt: number;
}

export interface CaseContext {
  id: Id<"cases">;
  title: string;
  description?: string;
  status: string;
  priority: string;
  category?: string;
  startDate: number;
  endDate?: number;
  assignedLawyer: Id<"users">;
  createdBy: Id<"users">;
  isArchived: boolean;
  tags?: string[];
}

export interface ClientContext {
  id: Id<"clients">;
  name: string;
  email?: string;
  phone?: string;
  dni?: string;
  cuit?: string;
  clientType: "individual" | "company";
  isActive: boolean;
  role?: string; // plaintiff, defendant, witness, etc.
}

export interface ViewContext {
  currentPage?: string; // "documents", "escritos", "clients", etc.
  currentView?: string; // "list", "detail", "editor"
  selectedItems?: string[];
  cursorPosition?: number;
  searchQuery?: string;
  currentEscritoId?: Id<"escritos">;
}

export interface ActivityContext {
  action: string;
  entityType: string;
  entityId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface RuleContext {
  name: string;
  description: string;
  customInstructions?: string;
  responseStyle?: string;
  citationFormat?: string;
}

export interface ContextMetadata {
  gatheredAt: number;
  totalTokens?: number;
  contextSources: string[];
  priority: "low" | "medium" | "high";
}

export interface CaseDocumentContext {
  name: string;
  id: string;
  type?: string;
}

/**
 * Context Service - Central service for gathering, optimizing, and formatting
 * context information for the legal assistant agent.
 */
export class ContextService {

  /**
   * Gather automatic context for a user and case combination
   */
  static async gatherAutoContext(
    ctx: any,
    userId: Id<"users">,
    caseId?: Id<"cases">,
    viewContext?: ViewContext,
    resolvedReferences?: ResolvedReference[]
  ): Promise<ContextBundle> {
    const startTime = Date.now();

    // Gather context components in parallel
    const [userContext, caseContext, clientContexts, recentActivity, userRules, caseRules, caseDocuments] = await Promise.all([
      this.getUserContext(ctx, userId),
      caseId ? this.getCaseContext(ctx, caseId) : Promise.resolve(null),
      caseId ? this.getClientContexts(ctx, caseId) : Promise.resolve([]),
      this.getRecentActivity(ctx, userId, caseId),
      this.getUserRules(ctx, userId),
      caseId ? this.getCaseRules(ctx, caseId, userId) : Promise.resolve([]),
      caseId ? this.getCaseDocuments(ctx, caseId) : Promise.resolve([]),
    ]);

    // Merge rules (user-level and case-level)
    const rules: RuleContext[] = [...userRules, ...caseRules];
    const metadata: ContextMetadata = {
      gatheredAt: Date.now(),
      contextSources: ["user", "case", "clients", "activity"],
      priority: caseId ? "high" : "medium",
    };

    const contextBundle: ContextBundle = {
      user: userContext,
      case: caseContext,
      clients: clientContexts,
      currentView: viewContext || {},
      recentActivity,
      rules,
      metadata,
      caseDocuments,
      resolvedReferences: resolvedReferences || [],
    };

    // Optimize for token limits
    return this.optimizeForTokens(contextBundle);
  }

  // -------------------------------
  // Rules helpers
  // -------------------------------
  private static async getUserRules(ctx: any, userId: Id<"users">): Promise<RuleContext[]> {
    const rules = await ctx.db
      .query("agentRules")
      .withIndex("by_user_and_active", (q: any) => q.eq("userId", userId))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .collect();

    const sorted = rules.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    return sorted.map((r: any) => ({
      name: r.name,
      description: r.content,
    }));
  }

  private static async getCaseRules(ctx: any, caseId: Id<"cases">, userId: Id<"users">): Promise<RuleContext[]> {
    // Note: access control is enforced in queries/mutations; here we assume caller validated
    const rules = await ctx.db
      .query("agentRules")
      .withIndex("by_case_and_active", (q: any) => q.eq("caseId", caseId))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .collect();

    const sorted = rules.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    return sorted.map((r: any) => ({
      name: r.name,
      description: r.content,
    }));
  }

  /**
   * Get user context information including team memberships
   */
  private static async getUserContext(
    ctx: any,
    userId: Id<"users">
  ): Promise<UserContext> {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Get user's team memberships
    const teamMemberships = await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .collect();

    // Get team details for each membership
    const teams: TeamMembership[] = [];
    for (const membership of teamMemberships) {
      const team = await ctx.db.get(membership.teamId);
      if (team && team.isActive) {
        teams.push({
          id: team._id,
          name: team.name,
          role: membership.role,
          joinedAt: membership.joinedAt,
        });
      }
    }

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      specializations: user.specializations,
      firmName: user.firmName,
      experienceYears: user.experienceYears,
      teams,
      preferences: user.preferences ? {
        agentResponseStyle: user.preferences.agentResponseStyle,
        defaultJurisdiction: user.preferences.defaultJurisdiction,
        citationFormat: user.preferences.citationFormat,
        language: user.preferences.language,
      } : undefined,
    };
  }

  /**
   * Get case context with metadata and timeline
   */
  private static async getCaseContext(
    ctx: any,
    caseId: Id<"cases">
  ): Promise<CaseContext> {
    const caseDoc = await ctx.db.get(caseId);
    if (!caseDoc) {
      throw new Error(`Case not found: ${caseId}`);
    }

    return {
      id: caseDoc._id,
      title: caseDoc.title,
      description: caseDoc.description,
      status: caseDoc.status,
      priority: caseDoc.priority,
      category: caseDoc.category,
      startDate: caseDoc.startDate,
      endDate: caseDoc.endDate,
      assignedLawyer: caseDoc.assignedLawyer,
      createdBy: caseDoc.createdBy,
      isArchived: caseDoc.isArchived,
      tags: caseDoc.tags,
    };
  }

  /**
   * Get clients associated with a case
   */
  private static async getClientContexts(
    ctx: any,
    caseId: Id<"cases">
  ): Promise<ClientContext[]> {
    // Get client-case relationships
    const clientCases = await ctx.db
      .query("clientCases")
      .withIndex("by_case", (q: any) => q.eq("caseId", caseId))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .collect();

    // Get client details
    const clientContexts: ClientContext[] = [];
    for (const clientCase of clientCases) {
      const client = await ctx.db.get(clientCase.clientId);
      if (client && client.isActive) {
        clientContexts.push({
          id: client._id,
          name: client.name,
          email: client.email,
          phone: client.phone,
          dni: client.dni,
          cuit: client.cuit,
          clientType: client.clientType,
          isActive: client.isActive,
          role: clientCase.role,
        });
      }
    }

    return clientContexts;
  }

  /**
   * Get recent user activity (placeholder - will be enhanced later)
   */
  private static async getRecentActivity(
    ctx: any,
    userId: Id<"users">,
    caseId?: Id<"cases">
  ): Promise<ActivityContext[]> {
    // For now, return empty array - this will be enhanced with activity logging
    return [];
  }

  /**
   * Get case documents for quick reference
   */
  private static async getCaseDocuments(
    ctx: any,
    caseId: Id<"cases">
  ): Promise<CaseDocumentContext[]> {
    // Get case documents
    const caseDocuments = await ctx.db
      .query("documents")
      .withIndex("by_case", (q: any) => q.eq("caseId", caseId))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .collect();

    return caseDocuments.map((doc: any) => ({
      name: doc.title || doc.name || "Sin título",
      id: doc._id,
      type: doc.type || doc.category,
    }));
  }

  /**
   * Optimize context bundle for token limits
   */
  private static optimizeForTokens(contextBundle: ContextBundle): ContextBundle {
    // For now, return as-is - this will be enhanced with token counting
    // and context prioritization logic
    return contextBundle;
  }

  /**
   * Format context bundle into a structured prompt for the agent
   */
  static formatContextForAgent(contextBundle: ContextBundle): string {
    const sections: string[] = [];

    // User information
    sections.push(`## Informacion del usuario
- Nombre: ${contextBundle.user.name}
- Email: ${contextBundle.user.email}
- Rol: ${contextBundle.user.role || 'No especificado'}
- Especialidades: ${contextBundle.user.specializations?.join(', ') || 'No especificado'}
- Firma: ${contextBundle.user.firmName || 'No especificado'}
- Experiencia: ${contextBundle.user.experienceYears ? `${contextBundle.user.experienceYears} years` : 'No especificado'}
- Equipos: ${contextBundle.user.teams?.map(t => `${t.name} (${t.role})`).join(', ') || 'No especificado'}`);

    // Case information
    if (contextBundle.case) {
      const caseInfo = contextBundle.case;
      sections.push(`## Caso actual
- Title: ${caseInfo.title}
- ID: ${caseInfo.id}
- Descripcion: ${caseInfo.description || 'No description'}
- Estado: ${caseInfo.status}
- Prioridad: ${caseInfo.priority}
- Categoria: ${caseInfo.category || 'No especificado'}
- Fecha de inicio: ${new Date(caseInfo.startDate).toLocaleDateString()}
- Fecha de fin: ${caseInfo.endDate ? new Date(caseInfo.endDate).toLocaleDateString() : 'No especificado'}
- Tags: ${caseInfo.tags?.join(', ') || 'None'}`);
    }

    // Client information
    if (contextBundle.clients.length > 0) {
      const clientInfo = contextBundle.clients
        .map(client => `- ${client.name} (${client.clientType}${client.role ? `, ${client.role}` : ''})`)
        .join('\n');
      sections.push(`## Clientes del caso
${clientInfo}`);
    }

    // Current view context
    if (contextBundle.currentView.currentPage) {
      const view = contextBundle.currentView;
      let viewSection = `## Current View
- Pagina: ${view.currentPage}
- Modo de vista: ${view.currentView || 'Default'}`;

      if (view.selectedItems && view.selectedItems.length > 0) {
        viewSection += `\n- Items seleccionados: ${view.selectedItems.length} item(s)`;
      }

      if (view.cursorPosition) {
        viewSection += `\n- Posicion del cursor: Line ${view.cursorPosition}`;
      }

      if (view.searchQuery) {
        viewSection += `\n- Consulta de busqueda: "${view.searchQuery}"`;
      }

      if (view.currentEscritoId) {
        viewSection += `\n- Trabajando en Escrito: ${view.currentEscritoId}`;
      }

      sections.push(viewSection);
    }

    // Recent activity
    if (contextBundle.recentActivity.length > 0) {
      const activityInfo = contextBundle.recentActivity
        .slice(0, 5) // Limitar a las últimas 5 actividades
        .map(activity => `- ${activity.action} on ${activity.entityType} (${new Date(activity.timestamp).toLocaleTimeString()})`)
        .join('\n');
      sections.push(`## Actividad reciente
${activityInfo}`);
    }

    // Case documents
    if (contextBundle.caseDocuments.length > 0) {
      const documentsText = contextBundle.caseDocuments
        .map(doc => `- ${doc.name}|${doc.id}${doc.type ? ` (${doc.type})` : ''}`)
        .join('\n');
      sections.push(`## Documentos del caso
${documentsText}`);
    }

    // Resolved references from @-mentions
    if (contextBundle.resolvedReferences && contextBundle.resolvedReferences.length > 0) {
      const referencesText = contextBundle.resolvedReferences
        .map(ref => `- @${ref.type}:${ref.name} (ID: ${ref.id})`)
        .join('\n');
      sections.push(`## Referencias mencionadas en el mensaje
${referencesText}`);
    }

    // Agent rules
    if (contextBundle.rules.length > 0) {
      const rulesText = contextBundle.rules
        .map((r, idx) => `${idx + 1}. ${r.name} — ${r.description}`)
        .join('\n');
      sections.push(`## Reglas del Agente\n${rulesText}`);
    }

    return sections.join('\n\n');
  }
}
