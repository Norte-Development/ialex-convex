/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as functions_cases from "../functions/cases.js";
import type * as functions_chat from "../functions/chat.js";
import type * as functions_clients from "../functions/clients.js";
import type * as functions_documents from "../functions/documents.js";
import type * as functions_index from "../functions/index.js";
import type * as functions_teams from "../functions/teams.js";
import type * as functions_templates from "../functions/templates.js";
import type * as functions_users from "../functions/users.js";
import type * as myFunctions from "../myFunctions.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "functions/cases": typeof functions_cases;
  "functions/chat": typeof functions_chat;
  "functions/clients": typeof functions_clients;
  "functions/documents": typeof functions_documents;
  "functions/index": typeof functions_index;
  "functions/teams": typeof functions_teams;
  "functions/templates": typeof functions_templates;
  "functions/users": typeof functions_users;
  myFunctions: typeof myFunctions;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
