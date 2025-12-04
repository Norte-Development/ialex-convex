import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";

// Use a 96-bit IV for AES-GCM, which is the recommended and most compatible size.
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Convert hex string to ArrayBuffer
 */
function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to hex string
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Encrypt password using AES-256-GCM with Web Crypto API
 */
async function encryptPassword(
  password: string,
  secretKey: string
): Promise<{ encrypted: string; iv: string }> {
  // Generate random IV
  const iv = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(iv);

  // Convert hex key to ArrayBuffer
  const keyBuffer = hexToArrayBuffer(secretKey);

  // Import key
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  // Encrypt
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      // tagLength defaults to 128 bits for AES-GCM; we rely on the default for compatibility.
    },
    key,
    encoder.encode(password)
  );

  return {
    encrypted: arrayBufferToHex(encrypted),
    iv: arrayBufferToHex(iv.buffer),
  };
}

/**
 * Decrypt password using AES-256-GCM with Web Crypto API
 */
async function decryptPassword(
  encrypted: string,
  iv: string,
  secretKey: string
): Promise<string> {
  // Convert hex strings to ArrayBuffers
  const ivBuffer = hexToArrayBuffer(iv);
  const encryptedBuffer = hexToArrayBuffer(encrypted);
  const keyBuffer = hexToArrayBuffer(secretKey);

  // Import key
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBuffer,
      // tagLength defaults to 128 bits for AES-GCM; we rely on the default for compatibility.
    },
    key,
    encryptedBuffer
  );

  // Convert to string
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): string {
  const key = process.env.PJN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("PJN_ENCRYPTION_KEY environment variable is not set");
  }
  // Key should be 64 hex characters (32 bytes for AES-256)
  if (key.length !== 64) {
    throw new Error("PJN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  }
   // Ensure key is a valid hex string
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("PJN_ENCRYPTION_KEY must be a 64-character hex string");
  }
  return key;
}

/**
 * Save PJN credentials for a user
 */
export const saveCredentials = mutation({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: true; accountId: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const encryptionKey = getEncryptionKey();
    const { encrypted, iv } = await encryptPassword(args.password, encryptionKey);

    const now = Date.now();

    // Check if account already exists
    const existing = await ctx.db
      .query("pjnAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      // Update existing account
      await ctx.db.patch(existing._id, {
        username: args.username,
        encryptedPassword: encrypted,
        iv,
        isActive: true,
        sessionValid: true,
        needsReauth: false,
        lastAuthAt: now,
        updatedAt: now,
      });
      return { success: true, accountId: existing._id };
    } else {
      // Create new account
      const accountId = await ctx.db.insert("pjnAccounts", {
        userId: user._id,
        username: args.username,
        encryptedPassword: encrypted,
        iv,
        isActive: true,
        sessionValid: true,
        needsReauth: false,
        lastAuthAt: now,
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, accountId };
    }
  },
});

type ReauthSuccessResponse = {
  status: "OK";
  sessionSaved: boolean;
};

type ReauthAuthFailedResponse = {
  status: "AUTH_FAILED";
  reason: string;
};

type ReauthErrorResponse = {
  status: "ERROR";
  error: string;
};

type ReauthResponse = ReauthSuccessResponse | ReauthAuthFailedResponse | ReauthErrorResponse;

/**
 * Public action: Connect PJN account by validating credentials with the scraper
 * service and only saving them if the initial login succeeds.
 */
export const connectAccount = action({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const scraperUrl = process.env.PJN_SCRAPER_URL;
    if (!scraperUrl) {
      throw new Error("PJN_SCRAPER_URL environment variable is not set");
    }

    const serviceAuthSecret = process.env.EXPEDIENTES_SCRAPER_SECRET;
    if (!serviceAuthSecret) {
      throw new Error("EXPEDIENTES_SCRAPER_SECRET environment variable is not set");
    }

    const currentUser = await ctx.runQuery(
      api.functions.users.getCurrentUser,
      {},
    );
    if (!currentUser?._id) {
      throw new Error("User not found");
    }

    // First, validate credentials by calling the scraper's /reauth endpoint.
    const reauthBody: {
      userId: string;
      username: string;
      password: string;
    } = {
      userId: currentUser._id,
      username: args.username,
      password: args.password,
    };

    const response = await fetch(`${scraperUrl}/reauth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Auth": serviceAuthSecret,
      },
      body: JSON.stringify(reauthBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        status: "ERROR" as const,
        message: `Scraper returned ${response.status}: ${errorText}`,
      };
    }

    const result = (await response.json()) as {
      status: string;
      reason?: string;
      error?: string;
      [key: string]: unknown;
    };

    if (result.status === "AUTH_FAILED") {
      return {
        status: "AUTH_FAILED",
        message:
          typeof result.reason === "string"
            ? result.reason
            : "Credenciales de PJN inválidas",
      };
    }

    if (result.status === "ERROR") {
      return {
        status: "ERROR",
        message:
          typeof result.error === "string"
            ? result.error
            : "Error al conectar con el scraper de PJN",
      };
    }

    // If we reach here, the credentials worked and a session was created.
    const saveResult: { success: true; accountId: string } = await ctx.runMutation(
      api.pjn.accounts.saveCredentials,
      {
        username: args.username,
        password: args.password,
      },
    );

    return {
      status: "OK",
      message: "PJN account connected successfully",
    };
  },
});

/**
 * Get PJN account status for current user
 */
export const getAccountStatus = query({
  args: {},
  handler: async (ctx): Promise<{
    username: string;
    lastAuthAt: number | undefined;
    lastSyncedAt: number | undefined;
    sessionValid: boolean | undefined;
    needsReauth: boolean | undefined;
    syncErrors:
      | {
          lastErrorAt: number;
          lastErrorReason: string;
          errorCount: number;
        }
      | undefined;
    isActive: boolean;
  } | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const account = await ctx.db
      .query("pjnAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!account) {
      return null;
    }

    return {
      username: account.username,
      lastAuthAt: account.lastAuthAt,
      lastSyncedAt: account.lastSyncedAt,
      sessionValid: account.sessionValid,
      needsReauth: account.needsReauth,
      syncErrors: account.syncErrors,
      isActive: account.isActive,
    };
  },
});

/**
 * Internal: Get decrypted password for a user (for scraper service)
 */
export const getDecryptedPassword = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{
    username: string;
    password: string;
    accountId: string;
  } | null> => {
    const account = await ctx.db
      .query("pjnAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!account || !account.isActive) {
      return null;
    }

    try {
      const encryptionKey = getEncryptionKey();
      const password = await decryptPassword(account.encryptedPassword, account.iv, encryptionKey);

      return {
        username: account.username,
        password,
        accountId: account._id,
      };
    } catch (error) {
      console.error("Failed to decrypt password", error);
      return null;
    }
  },
});

/**
 * Internal: Update sync status after successful sync
 */
export const updateSyncStatus = internalMutation({
  args: {
    userId: v.id("users"),
    lastEventId: v.optional(v.string()),
    lastSyncedAt: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const account = await ctx.db
      .query("pjnAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!account) {
      return;
    }

    await ctx.db.patch(account._id, {
      lastSyncedAt: args.lastSyncedAt,
      lastEventId: args.lastEventId,
      sessionValid: true,
      needsReauth: false,
      syncErrors: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal: Clear needsReauth flag after successful reauth
 */
export const clearNeedsReauth = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<void> => {
    const account = await ctx.db
      .query("pjnAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!account) {
      return;
    }

    await ctx.db.patch(account._id, {
      needsReauth: false,
      sessionValid: true,
      lastAuthAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal: Mark account as needing reauth
 */
export const markNeedsReauth = internalMutation({
  args: {
    userId: v.id("users"),
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const account = await ctx.db
      .query("pjnAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!account) {
      return;
    }

    const now = Date.now();
    const existingErrors = account.syncErrors || {
      lastErrorAt: now,
      lastErrorReason: args.reason,
      errorCount: 0,
    };

    await ctx.db.patch(account._id, {
      needsReauth: true,
      sessionValid: false,
      syncErrors: {
        lastErrorAt: now,
        lastErrorReason: args.reason,
        errorCount: existingErrors.errorCount + 1,
      },
      updatedAt: now,
    });
  },
});

/**
 * Internal: List all active PJN accounts
 */
export const listActiveAccounts = internalQuery({
  args: {},
  handler: async (ctx): Promise<
    Array<{
      accountId: string;
      userId: Id<"users">;
      username: string;
      lastSyncedAt: number | undefined;
      lastEventId: string | undefined;
      needsReauth: boolean | undefined;
    }>
  > => {
    const accounts = await ctx.db
      .query("pjnAccounts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    return accounts.map((account) => ({
      accountId: account._id,
      userId: account.userId,
      username: account.username,
      lastSyncedAt: account.lastSyncedAt,
      lastEventId: account.lastEventId,
      needsReauth: account.needsReauth,
    }));
  },
});

