import { Id } from "../convex/_generated/dataModel";

/**
 * Team role types for team membership and invites.
 */
export type TeamRole = "admin" | "abogado" | "secretario";

/**
 * Represents a user in the system (minimal fields for team context).
 * Extend this as needed to match your users table.
 */
export interface TeamUser {
  _id: Id<"users">;
  name: string;
  email: string;
  // Add other user fields as needed
}

/**
 * Represents a team member, including user info and membership details.
 */
export interface TeamMember extends TeamUser {
  teamRole: TeamRole;
  joinedAt: number;
}

/**
 * Represents a pending team invitation.
 */
export interface TeamInvite {
  _id: Id<"teamInvites">;
  email: string;
  role: TeamRole;
  status: "pending";
  expiresAt: number;
  // Optionally add: token, createdAt, etc.
}

/**
 * Represents a team, including members and pending invites.
 */
export interface TeamWithMembersAndInvites {
  _id: Id<"teams">;
  name: string;
  description?: string;
  teamLead: Id<"users">;
  isActive: boolean;
  createdBy: Id<"users">;
  // Add other team fields as needed

  members: TeamMember[];
  pendingInvites: TeamInvite[];
}
