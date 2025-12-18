import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

// ========================================
// GOOGLE DRIVE ACTIONS
// These actions take explicit userId arguments and use stored tokens
// ========================================

/**
 * Internal action: Create a Google Doc for a user.
 * Uses stored Google tokens to create a document via Google Drive API,
 * uploading HTML content that Google converts into a Docs file.
 * 
 * @param userId - The user whose Google account tokens to use
 * @param title - The title of the document
 * @param content - Initial content as HTML (required)
 * @returns The Google Doc ID
 */
export const createGoogleDoc = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    // NOTE: This is expected to be HTML.
    // We create the Google Doc in a single Drive multipart upload
    // using `text/html` so Google converts it.
    content: v.string(),
  },
  handler: async (ctx, args): Promise<{ docId: string; docUrl: string }> => {
    // Get stored Google tokens for this user
    const account = await ctx.runQuery(internal.google.drive.getGoogleAccount, {
      userId: args.userId,
    });

    if (!account) {
      throw new Error("User has not connected Google Drive");
    }

    // Check if token is expired and refresh if needed
    const accessToken = await ensureValidToken(ctx, args.userId, account);

    // Create the Google Doc in a single call via the Drive upload API
    // using multipart/related with text/html.
    return await createGoogleDocFromHtml(accessToken, args.title, args.content);
  },
});

/**
 * Internal action: Set permissions on a Google Doc.
 * 
 * @param userId - The user whose Google account tokens to use
 * @param docId - The Google Doc ID
 * @param email - Email address to grant access to
 * @param role - Permission role: "reader" or "writer"
 */
export const setDocPermissions = internalAction({
  args: {
    userId: v.id("users"),
    docId: v.string(),
    email: v.string(),
    role: v.union(v.literal("reader"), v.literal("writer")),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const account = await ctx.runQuery(internal.google.drive.getGoogleAccount, {
      userId: args.userId,
    });

    if (!account) {
      throw new Error("User has not connected Google Drive");
    }

    const accessToken = await ensureValidToken(ctx, args.userId, account);

    // Set permissions using Drive API
    const permissionResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${args.docId}/permissions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: args.role,
          type: "user",
          emailAddress: args.email,
        }),
      },
    );

    if (!permissionResponse.ok) {
      const error = await permissionResponse.text();
      throw new Error(`Failed to set permissions: ${error}`);
    }

    return { success: true };
  },
});

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Ensure the access token is valid, refreshing if necessary
 */
async function ensureValidToken(
  ctx: any,
  userId: Id<"users">,
  account: {
    accessToken: string;
    refreshToken?: string;
    expiryDate?: number;
    scope: string;
    tokenType: string;
  },
): Promise<string> {
  // Check if token is expired (with 5 minute buffer)
  const now = Date.now();
  const buffer = 5 * 60 * 1000; // 5 minutes

  if (
    account.expiryDate &&
    account.expiryDate < now + buffer &&
    account.refreshToken
  ) {
    // Token expired or about to expire, refresh it
    const refreshed = await refreshAccessToken(account.refreshToken);

    // Update stored tokens
    await ctx.runMutation(internal.google.drive.upsertGoogleAccount, {
      userId,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? account.refreshToken,
      expiryDate: refreshed.expires_in
        ? now + refreshed.expires_in * 1000
        : undefined,
      scope: account.scope,
      tokenType: refreshed.token_type,
    });

    return refreshed.access_token;
  }

  return account.accessToken;
}

/**
 * Refresh an expired access token using the refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  token_type: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth not configured");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  return await response.json();
}

/**
 * Create a Google Doc from HTML in a single call using the
 * Google Drive multipart upload endpoint. The HTML is sent
 * as `text/html` and converted server-side into a Docs file.
 */
async function createGoogleDocFromHtml(
  accessToken: string,
  title: string,
  html: string,
): Promise<{ docId: string; docUrl: string }> {
  const boundary = "foo_bar_baz";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: title,
    mimeType: "application/vnd.google-apps.document",
  };

  const multipartBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: text/html; charset=UTF-8\r\n\r\n" +
    html +
    closeDelimiter;

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Google Doc from HTML: ${error}`);
  }

  const data: { id: string } = await response.json();
  const docId = data.id;
  const docUrl = `https://docs.google.com/document/d/${docId}`;

  return { docId, docUrl };
}
