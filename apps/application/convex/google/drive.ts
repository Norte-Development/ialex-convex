import { mutation, internalMutation, internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { getCurrentUserFromAuth } from "../auth_utils";

// ========================================
// GOOGLE DRIVE OAUTH SERVICE
// Handles Google OAuth flow for Drive/Docs access
// Pure Convex runtime (queries/mutations) - no Node.js dependencies
// ========================================

// Google OAuth scopes for Drive API
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file", // Access to files created/opened by the app
];

/**
 * Build the scope parameter string for OAuth URL
 */
function getScopeParam(): string {
  return GOOGLE_SCOPES.join(" ");
}

/**
 * Generate a cryptographically random state token for OAuth flow
 */
function generateStateToken(): string {
  // Use crypto.randomUUID if available, otherwise fallback to random string
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return (
    Math.random().toString(36).slice(2) +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2)
  );
}

/**
 * Public mutation: Get Google OAuth URL for the current authenticated user.
 * Frontend calls this, then redirects the user to the returned URL.
 */
export const getGoogleAuthUrl = mutation({
  args: {},
  handler: async (ctx): Promise<{ url: string; state: string }> => {
    const user = await getCurrentUserFromAuth(ctx);

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new Error(
        "Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI environment variables.",
      );
    }

    const state = generateStateToken();

    // Store the OAuth state token linked to the user
    await ctx.runMutation(internal.google.drive.storeOAuthState, {
      state,
      userId: user._id,
    });

    // Build Google OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline", // Request refresh token
      prompt: "consent", // Force consent screen to ensure refresh_token
      scope: getScopeParam(),
      state,
      include_granted_scopes: "true",
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return { url, state };
  },
});

/**
 * Internal mutation: Store temporary OAuth state token.
 * Used to map the OAuth callback back to the user.
 */
export const storeOAuthState = internalMutation({
  args: {
    state: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<null> => {
    // Clean up old state tokens (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const oldStates = await ctx.db
      .query("googleOAuthStates")
      .withIndex("by_created_at", (q) => q.lt("createdAt", tenMinutesAgo))
      .collect();

    for (const oldState of oldStates) {
      await ctx.db.delete(oldState._id);
    }

    // Insert new state token
    await ctx.db.insert("googleOAuthStates", {
      state: args.state,
      userId: args.userId,
      createdAt: Date.now(),
    });

    return null;
  },
});

/**
 * Internal mutation: Upsert Google account tokens for a user.
 * Called from the HTTP callback after exchanging the authorization code for tokens.
 */
export const upsertGoogleAccount = internalMutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiryDate: v.optional(v.number()),
    scope: v.string(),
    tokenType: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"googleAccounts">> => {
    // Check if user already has a Google account linked
    const existing = await ctx.db
      .query("googleAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      // Update existing account
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken ?? existing.refreshToken,
        expiryDate: args.expiryDate ?? existing.expiryDate,
        scope: args.scope,
        tokenType: args.tokenType,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create new account
      const accountId = await ctx.db.insert("googleAccounts", {
        userId: args.userId,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken ?? undefined,
        expiryDate: args.expiryDate ?? undefined,
        scope: args.scope,
        tokenType: args.tokenType,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return accountId;
    }
  },
});

/**
 * Query: Check if the current user has Google Drive access connected.
 * Frontend can use this to show/hide "Connect Google Drive" button.
 */
export const hasGoogleDriveAccess = query({
  args: {},
  handler: async (ctx): Promise<{ connected: boolean; accountId?: Id<"googleAccounts"> }> => {
    try {
      const user = await getCurrentUserFromAuth(ctx);

      const account = await ctx.db
        .query("googleAccounts")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();

      return {
        connected: !!account,
        accountId: account?._id,
      };
    } catch {
      // User not authenticated or not found
      return { connected: false };
    }
  },
});

/**
 * Internal query: Get Google account tokens for a user.
 * Used by other functions that need to make Google API calls.
 */
export const getGoogleAccount = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiryDate?: number;
    scope: string;
    tokenType: string;
  } | null> => {
    const account = await ctx.db
      .query("googleAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!account) {
      return null;
    }

    return {
      accessToken: account.accessToken,
      refreshToken: account.refreshToken ?? undefined,
      expiryDate: account.expiryDate ?? undefined,
      scope: account.scope,
      tokenType: account.tokenType,
    };
  },
});

/**
 * Internal query: Get OAuth state record by state token.
 * Used by HTTP callback to find the user associated with the OAuth flow.
 */
export const getOAuthState = internalQuery({
  args: {
    state: v.string(),
  },
  handler: async (ctx, args): Promise<{
    _id: Id<"googleOAuthStates">;
    userId: Id<"users">;
    createdAt: number;
  } | null> => {
    const stateRecord = await ctx.db
      .query("googleOAuthStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .first();

    if (!stateRecord) {
      return null;
    }

    return {
      _id: stateRecord._id,
      userId: stateRecord.userId,
      createdAt: stateRecord.createdAt,
    };
  },
});

/**
 * Internal mutation: Delete OAuth state token.
 * Used to clean up used or expired state tokens.
 */
export const deleteOAuthState = internalMutation({
  args: {
    stateId: v.id("googleOAuthStates"),
  },
  handler: async (ctx, args): Promise<null> => {
    await ctx.db.delete(args.stateId);
    return null;
  },
});

/**
 * Internal mutation: Delete Google account connection.
 * Used when user wants to disconnect their Google account.
 */
export const deleteGoogleAccount = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const account = await ctx.db
      .query("googleAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (account) {
      await ctx.db.delete(account._id);
      return true;
    }

    return false;
  },
});

/**
 * Public mutation: Disconnect Google Drive access.
 * Frontend can call this to remove the Google account connection.
 */
export const disconnectGoogleDrive = mutation({
  args: {},
  handler: async (ctx): Promise<{ success: boolean }> => {
    const user = await getCurrentUserFromAuth(ctx);

    const deleted = await ctx.runMutation(
      internal.google.drive.deleteGoogleAccount,
      {
        userId: user._id,
      },
    );

    return { success: deleted };
  },
});
