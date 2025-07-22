/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as firebaseAdmin from "../firebaseAdmin.js";
import type * as functions_auth_utils from "../functions/auth_utils.js";
import type * as functions_cases from "../functions/cases.js";
import type * as functions_chat from "../functions/chat.js";
import type * as functions_clients from "../functions/clients.js";
import type * as functions_documents from "../functions/documents.js";
import type * as functions_index from "../functions/index.js";
import type * as functions_legalDb from "../functions/legalDb.js";
import type * as functions_seedCases from "../functions/seedCases.js";
import type * as functions_teams from "../functions/teams.js";
import type * as functions_templates from "../functions/templates.js";
import type * as functions_users from "../functions/users.js";
import type * as utils_resend from "../utils/resend.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  firebaseAdmin: typeof firebaseAdmin;
  "functions/auth_utils": typeof functions_auth_utils;
  "functions/cases": typeof functions_cases;
  "functions/chat": typeof functions_chat;
  "functions/clients": typeof functions_clients;
  "functions/documents": typeof functions_documents;
  "functions/index": typeof functions_index;
  "functions/legalDb": typeof functions_legalDb;
  "functions/seedCases": typeof functions_seedCases;
  "functions/teams": typeof functions_teams;
  "functions/templates": typeof functions_templates;
  "functions/users": typeof functions_users;
  "utils/resend": typeof utils_resend;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {
  resend: {
    lib: {
      cancelEmail: FunctionReference<
        "mutation",
        "internal",
        { emailId: string },
        null
      >;
      get: FunctionReference<"query", "internal", { emailId: string }, any>;
      getStatus: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          complained: boolean;
          errorMessage: string | null;
          opened: boolean;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced";
        }
      >;
      handleEmailEvent: FunctionReference<
        "mutation",
        "internal",
        { event: any },
        null
      >;
      sendEmail: FunctionReference<
        "mutation",
        "internal",
        {
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          options: {
            apiKey: string;
            initialBackoffMs: number;
            onEmailEvent?: { fnHandle: string };
            retryAttempts: number;
            testMode: boolean;
          };
          replyTo?: Array<string>;
          subject: string;
          text?: string;
          to: string;
        },
        string
      >;
    };
  };
};
