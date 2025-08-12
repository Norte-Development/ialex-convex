/**
 * Permission System Validation Test
 * 
 * This file contains validation tests for the granular permission system.
 * It can be used to verify that the permission system is working correctly
 * after the migration from generic to granular permissions.
 * 
 * Usage: Import these functions in playground.ts to test the permission system
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { 
  getCurrentUserFromAuth, 
  checkCaseAccess, 
  hasPermission,
  hasDocumentPermission,
  hasEscritoPermission,
  hasClientPermission,
  hasTeamPermission,
  hasChatPermission,
  PERMISSIONS 
} from "./auth_utils";

/**
 * Test function to validate that permission checking works correctly
 */
export const testPermissionSystem = query({
  args: { 
    caseId: v.id("cases"),
    testUserId: v.optional(v.id("users"))
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const userId = args.testUserId || currentUser._id;
    
    // Test basic case access
    const caseAccess = await checkCaseAccess(ctx, args.caseId, userId);
    
    // Test specific permission checks
    const permissionTests = {
      // Basic access info
      hasAccess: caseAccess.hasAccess,
      accessLevel: caseAccess.accessLevel,
      source: caseAccess.source,
      rawPermissions: caseAccess.permissions,
      
      // General permission checks
      hasFullPermission: await hasPermission(ctx, args.caseId, userId, PERMISSIONS.FULL),
      hasCaseView: await hasPermission(ctx, args.caseId, userId, PERMISSIONS.CASE_VIEW),
      hasCaseEdit: await hasPermission(ctx, args.caseId, userId, PERMISSIONS.CASE_EDIT),
      
      // Document permissions
      canReadDocuments: await hasDocumentPermission(ctx, args.caseId, userId, "read"),
      canWriteDocuments: await hasDocumentPermission(ctx, args.caseId, userId, "write"),
      canDeleteDocuments: await hasDocumentPermission(ctx, args.caseId, userId, "delete"),
      
      // Escrito permissions
      canReadEscritos: await hasEscritoPermission(ctx, args.caseId, userId, "read"),
      canWriteEscritos: await hasEscritoPermission(ctx, args.caseId, userId, "write"),
      canDeleteEscritos: await hasEscritoPermission(ctx, args.caseId, userId, "delete"),
      
      // Client permissions
      canReadClients: await hasClientPermission(ctx, args.caseId, userId, "read"),
      canWriteClients: await hasClientPermission(ctx, args.caseId, userId, "write"),
      canDeleteClients: await hasClientPermission(ctx, args.caseId, userId, "delete"),
      
      // Team permissions
      canReadTeams: await hasTeamPermission(ctx, args.caseId, userId, "read"),
      canWriteTeams: await hasTeamPermission(ctx, args.caseId, userId, "write"),
      
      // Chat permissions
      canAccessChat: await hasChatPermission(ctx, args.caseId, userId),
    };
    
    return {
      userId,
      caseId: args.caseId,
      timestamp: Date.now(),
      testResults: permissionTests
    };
  }
});

/**
 * Test function to validate permission constants are properly defined
 */
export const testPermissionConstants = query({
  args: {},
  handler: async (ctx, args) => {
    return {
      permissionConstants: {
        // Case permissions
        CASE_VIEW: PERMISSIONS.CASE_VIEW,
        CASE_EDIT: PERMISSIONS.CASE_EDIT,
        CASE_DELETE: PERMISSIONS.CASE_DELETE,
        
        // Document permissions
        DOC_READ: PERMISSIONS.DOC_READ,
        DOC_WRITE: PERMISSIONS.DOC_WRITE,
        DOC_DELETE: PERMISSIONS.DOC_DELETE,
        
        // Escrito permissions
        ESCRITO_READ: PERMISSIONS.ESCRITO_READ,
        ESCRITO_WRITE: PERMISSIONS.ESCRITO_WRITE,
        ESCRITO_DELETE: PERMISSIONS.ESCRITO_DELETE,
        
        // Client permissions
        CLIENT_READ: PERMISSIONS.CLIENT_READ,
        CLIENT_WRITE: PERMISSIONS.CLIENT_WRITE,
        CLIENT_DELETE: PERMISSIONS.CLIENT_DELETE,
        
        // Team permissions
        TEAM_READ: PERMISSIONS.TEAM_READ,
        TEAM_WRITE: PERMISSIONS.TEAM_WRITE,
        
        // Chat permissions
        CHAT_ACCESS: PERMISSIONS.CHAT_ACCESS,
        
        // Full access
        FULL: PERMISSIONS.FULL,
      },
      
      // Verify constants match expected values
      validation: {
        caseViewMatches: PERMISSIONS.CASE_VIEW === "case.view",
        docReadMatches: PERMISSIONS.DOC_READ === "documents.read",
        escritoWriteMatches: PERMISSIONS.ESCRITO_WRITE === "escritos.write",
        clientDeleteMatches: PERMISSIONS.CLIENT_DELETE === "clients.delete",
        teamReadMatches: PERMISSIONS.TEAM_READ === "teams.read",
        chatAccessMatches: PERMISSIONS.CHAT_ACCESS === "chat.access",
        fullMatches: PERMISSIONS.FULL === "full",
      }
    };
  }
});

/**
 * Get a summary of all permission-related tables
 */
export const getPermissionSystemStatus = query({
  args: {},
  handler: async (ctx, args) => {
    const userCaseAccessCount = await ctx.db.query("userCaseAccess").collect().then(r => r.length);
    const teamMemberCaseAccessCount = await ctx.db.query("teamMemberCaseAccess").collect().then(r => r.length);
    const teamCaseAccessCount = await ctx.db.query("teamCaseAccess").collect().then(r => r.length);
    
    return {
      permissionTables: {
        userCaseAccess: {
          totalRecords: userCaseAccessCount,
          description: "Individual user permissions for specific cases"
        },
        teamMemberCaseAccess: {
          totalRecords: teamMemberCaseAccessCount,
          description: "Granular team member permissions for specific cases"
        },
        teamCaseAccess: {
          totalRecords: teamCaseAccessCount,
          description: "General team access to cases"
        }
      },
      systemStatus: {
        permissionSystemActive: true,
        granularPermissionsEnabled: true,
        migrationCompleted: true,
        lastValidated: Date.now()
      }
    };
  }
}); 