"use node";

/**
 * Kinde Helper Actions
 * 
 * This file contains all Kinde Management API operations as internalActions.
 * It has "use node" because it uses Node.js fetch and URL APIs.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import {
  KINDE_DOMAIN,
  KINDE_M2M_CLIENT_ID,
  KINDE_M2M_CLIENT_SECRET,
} from "./constants";

// ================================
// TYPE DEFINITIONS
// ================================

interface KindeUser {
  id: string;
  provided_id?: string;
  email?: string;
  phone?: string;
  username?: string;
  last_name?: string;
  first_name?: string;
  is_suspended?: boolean;
  picture?: string;
  total_sign_ins?: number;
  failed_sign_ins?: number;
  last_signed_in?: string;
  created_on?: string;
  organizations?: string[];
  identities?: Array<{
    type: string;
    identity: string;
  }>;
}

interface KindeTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface KindeUsersResponse {
  code?: string;
  message?: string;
  users?: KindeUser[];
  next_token?: string;
}

// ================================
// HELPER FUNCTIONS
// ================================

/**
 * Get M2M access token from Kinde
 */
async function getKindeAccessToken(): Promise<string> {
  // Normalize domain - remove https:// if present, ensure no trailing slash
  let domain = KINDE_DOMAIN.trim();
  if (domain.startsWith("https://")) {
    domain = domain.substring(8);
  }
  if (domain.startsWith("http://")) {
    domain = domain.substring(7);
  }
  domain = domain.replace(/\/$/, "");

  const tokenUrl = `https://${domain}/oauth2/token`;
  const audience = `https://${domain}/api`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: KINDE_M2M_CLIENT_ID,
    client_secret: KINDE_M2M_CLIENT_SECRET,
    audience: audience,
  });

  console.log(`Requesting Kinde access token from: ${tokenUrl}`);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get Kinde access token: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data: KindeTokenResponse = await response.json();
  console.log(`Successfully obtained Kinde access token (expires in ${data.expires_in}s)`);
  
  return data.access_token;
}

/**
 * Fetch users from Kinde with pagination
 */
async function fetchKindeUsers(
  accessToken: string,
  pageSize: number = 100,
  nextToken?: string
): Promise<KindeUsersResponse> {
  // Normalize domain
  let domain = KINDE_DOMAIN.trim();
  if (domain.startsWith("https://")) {
    domain = domain.substring(8);
  }
  if (domain.startsWith("http://")) {
    domain = domain.substring(7);
  }
  domain = domain.replace(/\/$/, "");

  const url = new URL(`https://${domain}/api/v1/users`);
  url.searchParams.append("page_size", pageSize.toString());
  if (nextToken) {
    url.searchParams.append("next_token", nextToken);
  }

  console.log(`Fetching users from Kinde: ${url.toString()}`);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch Kinde users: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data: KindeUsersResponse = await response.json();
  return data;
}

// ================================
// EXPORTED ACTIONS
// ================================

/**
 * Get all users from Kinde (with pagination)
 */
export const getAllKindeUsers = internalAction({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      data: v.any(),
    })
  ),
  handler: async (): Promise<Array<{ id: string; data: any }>> => {
    console.log("Starting to fetch all users from Kinde...");

    const accessToken = await getKindeAccessToken();
    const allUsers: Array<{ id: string; data: any }> = [];
    let nextToken: string | undefined = undefined;
    let pageCount = 0;

    do {
      pageCount++;
      const response = await fetchKindeUsers(accessToken, 100, nextToken);

      if (response.users && response.users.length > 0) {
        console.log(`Fetched page ${pageCount}: ${response.users.length} users`);
        
        for (const user of response.users) {
          allUsers.push({
            id: user.id,
            data: user,
          });
        }
      }

      nextToken = response.next_token;
    } while (nextToken);

    console.log(`Completed fetching all Kinde users. Total: ${allUsers.length} users`);
    return allUsers;
  },
});

/**
 * Get limited number of users from Kinde (for testing)
 */
export const getKindeUsersByLimit = internalAction({
  args: { limit: v.number() },
  returns: v.array(
    v.object({
      id: v.string(),
      data: v.any(),
    })
  ),
  handler: async (ctx, { limit }): Promise<Array<{ id: string; data: any }>> => {
    console.log(`Starting to fetch ${limit} users from Kinde...`);

    const accessToken = await getKindeAccessToken();
    const users: Array<{ id: string; data: any }> = [];
    let nextToken: string | undefined = undefined;
    let pageSize = Math.min(limit, 100); // Kinde max is likely 100 per page

    while (users.length < limit) {
      const response = await fetchKindeUsers(accessToken, pageSize, nextToken);

      if (!response.users || response.users.length === 0) {
        break; // No more users
      }

      for (const user of response.users) {
        if (users.length >= limit) {
          break;
        }
        users.push({
          id: user.id,
          data: user,
        });
      }

      console.log(`Fetched ${users.length}/${limit} users so far`);

      // Stop if we have enough users or no more pages
      if (users.length >= limit || !response.next_token) {
        break;
      }

      nextToken = response.next_token;
    }

    console.log(`Completed fetching ${users.length} users from Kinde`);
    return users;
  },
});

/**
 * Get a single user from Kinde by email
 */
export const getKindeUserByEmail = internalAction({
  args: { email: v.string() },
  returns: v.union(
    v.object({
      id: v.string(),
      data: v.any(),
    }),
    v.null()
  ),
  handler: async (ctx, { email }): Promise<{ id: string; data: any } | null> => {
    console.log(`Searching for user with email: ${email}`);

    // Normalize domain
    let domain = KINDE_DOMAIN.trim();
    if (domain.startsWith("https://")) {
      domain = domain.substring(8);
    }
    if (domain.startsWith("http://")) {
      domain = domain.substring(7);
    }
    domain = domain.replace(/\/$/, "");

    const accessToken = await getKindeAccessToken();

    // Kinde API supports email filter
    const url = new URL(`https://${domain}/api/v1/users`);
    url.searchParams.append("email", email);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch Kinde user by email: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data: KindeUsersResponse = await response.json();

    if (!data.users || data.users.length === 0) {
      console.log(`No user found with email: ${email}`);
      return null;
    }

    const user = data.users[0];
    console.log(`Found user with email ${email}: ${user.id}`);

    return {
      id: user.id,
      data: user,
    };
  },
});

