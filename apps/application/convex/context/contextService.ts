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
    viewContext?: ViewContext
  ): Promise<ContextBundle> {
    const startTime = Date.now();

    // Gather context components in parallel
    const [userContext, caseContext, clientContexts, recentActivity] = await Promise.all([
      this.getUserContext(ctx, userId),
      caseId ? this.getCaseContext(ctx, caseId) : Promise.resolve(null),
      caseId ? this.getClientContexts(ctx, caseId) : Promise.resolve([]),
      this.getRecentActivity(ctx, userId, caseId),
    ]);

    // For now, use empty rules and basic metadata
    const rules: RuleContext[] = [];
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
    };

    // Optimize for token limits
    return this.optimizeForTokens(contextBundle);
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
    sections.push(`## User Information
- Name: ${contextBundle.user.name}
- Email: ${contextBundle.user.email}
- Role: ${contextBundle.user.role || 'Not specified'}
- Specializations: ${contextBundle.user.specializations?.join(', ') || 'Not specified'}
- Firm: ${contextBundle.user.firmName || 'Not specified'}
- Experience: ${contextBundle.user.experienceYears ? `${contextBundle.user.experienceYears} years` : 'Not specified'}
- Teams: ${contextBundle.user.teams?.map(t => `${t.name} (${t.role})`).join(', ') || 'Not specified'}`);

    // Case information
    if (contextBundle.case) {
      const caseInfo = contextBundle.case;
      sections.push(`## Current Case
- Title: ${caseInfo.title}
- ID: ${caseInfo.id}
- Description: ${caseInfo.description || 'No description'}
- Status: ${caseInfo.status}
- Priority: ${caseInfo.priority}
- Category: ${caseInfo.category || 'Not specified'}
- Start Date: ${new Date(caseInfo.startDate).toLocaleDateString()}
- End Date: ${caseInfo.endDate ? new Date(caseInfo.endDate).toLocaleDateString() : 'Not set'}
- Tags: ${caseInfo.tags?.join(', ') || 'None'}`);
    }

    // Client information
    if (contextBundle.clients.length > 0) {
      const clientInfo = contextBundle.clients
        .map(client => `- ${client.name} (${client.clientType}${client.role ? `, ${client.role}` : ''})`)
        .join('\n');
      sections.push(`## Case Clients
${clientInfo}`);
    }

    // Current view context
    if (contextBundle.currentView.currentPage) {
      const view = contextBundle.currentView;
      let viewSection = `## Current View
- Page: ${view.currentPage}
- View Mode: ${view.currentView || 'Default'}`;

      if (view.selectedItems && view.selectedItems.length > 0) {
        viewSection += `\n- Selected Items: ${view.selectedItems.length} item(s)`;
      }

      if (view.cursorPosition) {
        viewSection += `\n- Cursor Position: Line ${view.cursorPosition}`;
      }

      if (view.searchQuery) {
        viewSection += `\n- Search Query: "${view.searchQuery}"`;
      }

      if (view.currentEscritoId) {
        viewSection += `\n- Working on Escrito: ${view.currentEscritoId}`;
      }

      sections.push(viewSection);
    }

    // Recent activity
    if (contextBundle.recentActivity.length > 0) {
      const activityInfo = contextBundle.recentActivity
        .slice(0, 5) // Limit to last 5 activities
        .map(activity => `- ${activity.action} on ${activity.entityType} (${new Date(activity.timestamp).toLocaleTimeString()})`)
        .join('\n');
      sections.push(`## Recent Activity
${activityInfo}`);
    }

    return sections.join('\n\n');
  }
}
