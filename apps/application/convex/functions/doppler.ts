/**
 * Doppler Marketing Lists API Integration
 * 
 * This module provides actions for integrating with Doppler's Marketing Lists API.
 * All functions are implemented as actions (not mutations) to allow for
 * asynchronous execution via the scheduler.
 * 
 * Required environment variables:
 * - DOPPLER_API_KEY: Authentication token for Doppler API
 * - DOPPLER_ACCOUNT_NAME: Your Doppler account name
 */

import { internalAction, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type {
  DopplerSubscriber,
  DopplerFieldValue,
  AddSubscriberResult,
  DopplerList,
  GetListsResult,
  DopplerErrorResponse,
  DopplerSuccessResponse,
} from "../types/doppler";

/**
 * Doppler API base URL
 */
const DOPPLER_API_BASE_URL = "https://api.doppler.com/v3";

/**
 * Maximum number of retry attempts for failed requests
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Base delay in milliseconds for exponential backoff retries
 */
const BASE_RETRY_DELAY_MS = 1000;

/**
 * Validates email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates field name format (alphanumeric, underscores, hyphens, and ñ/Ñ)
 */
function isValidFieldName(name: string): boolean {
  const fieldNameRegex = /^[0-9a-zA-ZñÑ\-_]+$/;
  return name.length > 0 && name.length <= 50 && fieldNameRegex.test(name);
}

/**
 * Validates field value length
 */
function isValidFieldValue(value: string): boolean {
  return value.length >= 0 && value.length <= 400;
}

/**
 * Validates subscriber data before sending to API
 */
function validateSubscriber(subscriber: DopplerSubscriber): { valid: boolean; error?: string } {
  if (!subscriber.email || !isValidEmail(subscriber.email)) {
    return { valid: false, error: "Invalid email address" };
  }

  if (subscriber.email.length > 100) {
    return { valid: false, error: "Email address exceeds maximum length (100 characters)" };
  }

  if (subscriber.fields) {
    for (const field of subscriber.fields) {
      if (!isValidFieldName(field.name)) {
        return {
          valid: false,
          error: `Invalid field name: ${field.name}. Must be alphanumeric with underscores, hyphens, or ñ/Ñ, max 50 characters`,
        };
      }
      if (!isValidFieldValue(field.value)) {
        return {
          valid: false,
          error: `Invalid field value length for ${field.name}. Maximum 400 characters`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Gets authentication headers for Doppler API requests
 * 
 * @returns Headers object with Authorization and Content-Type
 * @throws Error if DOPPLER_API_KEY is not configured
 */
function getAuthHeaders(): HeadersInit {
  const apiKey = process.env.DOPPLER_API_KEY;
  if (!apiKey) {
    throw new Error("DOPPLER_API_KEY environment variable is not set");
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Doppler-Subscriber-Origin": "ialex",
  };
}

/**
 * Gets the account name from environment variables
 * 
 * @returns Account name
 * @throws Error if DOPPLER_ACCOUNT_NAME is not configured
 */
function getAccountName(): string {
  const accountName = process.env.DOPPLER_ACCOUNT_NAME;
  if (!accountName) {
    throw new Error("DOPPLER_ACCOUNT_NAME environment variable is not set");
  }
  return accountName;
}


/**
 * Internal query to get user by ID for Doppler integration
 */
export const getUserForDoppler = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      barNumber: user.barNumber,
      firmName: user.firmName,
      workLocation: user.workLocation,
      experienceYears: user.experienceYears,
      bio: user.bio,
      specializations: user.specializations,
      hasDespacho: user.hasDespacho,
      isOnboardingComplete: user.isOnboardingComplete,
      trialStatus: user.trialStatus,
    };
  },
});

/**
 * Parses a full name into first and last name
 * Simple heuristic: splits on first space
 */
function parseName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const spaceIndex = trimmed.indexOf(" ");
  
  if (spaceIndex === -1) {
    // No space found, treat entire string as first name
    return { firstName: trimmed, lastName: "" };
  }
  
  return {
    firstName: trimmed.substring(0, spaceIndex),
    lastName: trimmed.substring(spaceIndex + 1),
  };
}

/**
 * Maps user data to Doppler subscriber fields
 * Only includes non-empty values to avoid sending unnecessary data
 */
function mapUserToDopplerFields(user: NonNullable<Awaited<ReturnType<typeof getUserForDoppler>>>): DopplerFieldValue[] {
  const fields: DopplerFieldValue[] = [];
  
  // Parse name into firstName and lastName
  if (user.name) {
    const { firstName, lastName } = parseName(user.name);
    if (firstName) {
      fields.push({ name: "firstName", value: firstName });
    }
    if (lastName) {
      fields.push({ name: "lastName", value: lastName });
    }
  }
  
  // Add userId for tracking
  fields.push({ name: "userId", value: user._id });
  
  // Add role if available
  if (user.role) {
    fields.push({ name: "role", value: user.role });
  }
  
  // Add professional information
  if (user.barNumber) {
    fields.push({ name: "barNumber", value: user.barNumber });
  }
  
  if (user.firmName) {
    fields.push({ name: "firmName", value: user.firmName });
  }
  
  if (user.workLocation) {
    fields.push({ name: "workLocation", value: user.workLocation });
  }
  
  if (user.experienceYears !== undefined) {
    fields.push({ name: "experienceYears", value: String(user.experienceYears) });
  }
  
  if (user.hasDespacho !== undefined) {
    fields.push({ name: "hasDespacho", value: user.hasDespacho ? "true" : "false" });
  }
  
  // Add trial status if available
  if (user.trialStatus) {
    fields.push({ name: "trialStatus", value: user.trialStatus });
  }
  
  // Add onboarding status
  if (user.isOnboardingComplete !== undefined) {
    fields.push({ name: "isOnboardingComplete", value: user.isOnboardingComplete ? "true" : "false" });
  }
  
  // Add specializations as comma-separated string if available
  if (user.specializations && user.specializations.length > 0) {
    const specializationsValue = user.specializations.slice(0, 10).join(", "); // Limit to avoid exceeding 400 char limit
    if (specializationsValue.length <= 400) {
      fields.push({ name: "specializations", value: specializationsValue });
    }
  }
  
  return fields;
}

/**
 * Sleeps for the specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Performs an HTTP request with retry logic and exponential backoff
 * 
 * @param url - Request URL
 * @param options - Fetch options
 * @param attempt - Current attempt number (default: 1)
 * @returns Response object
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  attempt: number = 1,
): Promise<Response> {
  try {
    const response = await fetch(url, options);

    // Retry on network errors or 5xx server errors
    if (!response.ok && response.status >= 500 && attempt < MAX_RETRY_ATTEMPTS) {
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(
        `Doppler API request failed with status ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS})`,
      );
      await sleep(delay);
      return fetchWithRetry(url, options, attempt + 1);
    }

    return response;
  } catch (error) {
    // Retry on network errors
    if (attempt < MAX_RETRY_ATTEMPTS) {
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(
        `Doppler API request network error, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}):`,
        error,
      );
      await sleep(delay);
      return fetchWithRetry(url, options, attempt + 1);
    }
    throw error;
  }
}

/**
 * Adds a subscriber to a Doppler marketing list
 * 
 * This action can be scheduled using ctx.scheduler for non-blocking execution.
 * It handles errors gracefully and will not block user-facing operations.
 * 
 * The function automatically infers subscriber fields from the user record,
 * including name (parsed into firstName/lastName), role, professional info,
 * and other relevant user data.
 * 
 * @param userId - User ID to add to the list
 * @param listId - Doppler list ID (string or number)
 * @returns Result object indicating success or failure
 * 
 * @example
 * ```typescript
 * // Schedule adding a user to a list after signup
 * await ctx.scheduler.runAfter(0, internal.functions.doppler.addSubscriberToList, {
 *   userId: user._id,
 *   listId: "12345"
 * });
 * ```
 */
export const addSubscriberToList = internalAction({
  args: {
    userId: v.id("users"),
    listId: v.union(v.string(), v.number()),
  },
  handler: async (ctx, args): Promise<AddSubscriberResult> => {
    const startTime = Date.now();

    try {
      // Fetch user data
      const user = await ctx.runQuery(internal.functions.doppler.getUserForDoppler, {
        userId: args.userId,
      });

      if (!user) {
        console.error(`[Doppler] User not found: ${args.userId}`);
        return { success: false, error: `User not found: ${args.userId}` };
      }

      if (!user.email) {
        console.error(`[Doppler] User has no email: ${args.userId}`);
        return { success: false, error: `User has no email address` };
      }

      // Map user data to Doppler fields
      const fields = mapUserToDopplerFields(user);

      // Build subscriber object
      const subscriber: DopplerSubscriber = {
        email: user.email.trim().toLowerCase(),
        fields: fields.length > 0 ? fields : undefined,
      };

      // Validate subscriber data
      const validation = validateSubscriber(subscriber);
      if (!validation.valid) {
        console.error(`[Doppler] Validation failed for ${subscriber.email}:`, validation.error);
        return { success: false, error: validation.error };
      }

      // Get configuration
      const accountName = getAccountName();
      const listId = String(args.listId);
      const headers = getAuthHeaders();

      // Build request
      const url = `${DOPPLER_API_BASE_URL}/accounts/${accountName}/lists/${listId}/subscribers`;
      const body = JSON.stringify(subscriber);

      console.log(`[Doppler] Adding subscriber ${subscriber.email} (user: ${args.userId}) to list ID: ${listId}`);

      // Make API request with retry logic
      const response = await fetchWithRetry(url, {
        method: "POST",
        headers,
        body,
      });

      const duration = Date.now() - startTime;

      // Handle response
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const errorData: DopplerErrorResponse = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // If response is not JSON, use status text
        }

        // Log error but don't throw - we want to be resilient
        console.error(
          `[Doppler] Failed to add subscriber ${subscriber.email} (user: ${args.userId}) to list ID ${listId}:`,
          errorMessage,
          `(duration: ${duration}ms)`,
        );

        // Handle specific error cases
        if (response.status === 404) {
          // List or account not found - log but continue
          return {
            success: false,
            error: `List ID ${listId} not found`,
          };
        }

        if (response.status === 400) {
          // Bad request - likely duplicate or invalid data
          // Doppler handles duplicates gracefully, so this might be other validation error
          return {
            success: false,
            error: `Invalid request: ${errorMessage}`,
          };
        }

        // For other errors, return failure but don't block
        return {
          success: false,
          error: errorMessage,
        };
      }

      // Parse success response
      let data: DopplerSuccessResponse | undefined;
      try {
        data = await response.json();
      } catch {
        // Some endpoints might return empty responses
        data = { status: "success" };
      }

      console.log(
        `[Doppler] Successfully added subscriber ${subscriber.email} (user: ${args.userId}) to list ID ${listId} (duration: ${duration}ms)`,
      );

      return {
        success: true,
        data,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(
        `[Doppler] Unexpected error adding subscriber to list:`,
        errorMessage,
        `(duration: ${duration}ms)`,
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

/**
 * Gets available lists from Doppler account
 * 
 * This is a helper action for verifying list IDs and discovering available lists.
 * Useful for debugging and setup verification.
 * 
 * @param state - Filter by list state: "active", "inactive", or "all" (default: "all")
 * @param listName - Optional filter by list name
 * @returns Result object with list of available lists or error
 * 
 * @example
 * ```typescript
 * const result = await ctx.runAction(internal.functions.doppler.getAvailableLists, {
 *   state: "active"
 * });
 * if (result.success) {
 *   console.log("Available lists:", result.lists);
 * }
 * ```
 */
export const getAvailableLists = internalAction({
  args: {
    state: v.optional(v.union(v.literal("active"), v.literal("inactive"), v.literal("all"))),
    listName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<GetListsResult> => {
    try {
      const accountName = getAccountName();
      const headers = getAuthHeaders();

      // Build query parameters
      const params = new URLSearchParams();
      if (args.state && args.state !== "all") {
        params.append("state", args.state);
      }
      if (args.listName) {
        params.append("listName", args.listName);
      }

      const queryString = params.toString();
      const url = `${DOPPLER_API_BASE_URL}/accounts/${accountName}/lists${queryString ? `?${queryString}` : ""}`;

      console.log(`[Doppler] Fetching available lists (state: ${args.state || "all"})`);

      const response = await fetchWithRetry(url, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData: DopplerErrorResponse = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // If response is not JSON, use status text
        }

        console.error(`[Doppler] Failed to fetch lists:`, errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      }

      const data = await response.json();
      const lists: DopplerList[] = Array.isArray(data.items) ? data.items : data.items || [];

      console.log(`[Doppler] Found ${lists.length} lists`);

      return {
        success: true,
        lists,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Doppler] Unexpected error fetching lists:`, errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

