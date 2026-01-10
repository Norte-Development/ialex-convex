import { createTool, ToolCtx } from "@convex-dev/agent";
import { internal } from "../../../_generated/api";
import { z } from "zod";
import { createErrorResponse, getUserAndCaseIds } from "../shared/utils";
import { createCasesResultsTemplate } from "./templates";
import { Id } from "../../../_generated/dataModel";

/**
 * Schema for searchCasesTool arguments.
 * All fields have defaults to satisfy OpenAI's JSON schema requirements.
 */
const searchCasesToolArgs = z.object({
  query: z.string().default("").describe("The search query text to find relevant cases. Empty to get all cases."),
  limit: z.number().int().min(1).max(100).default(10).describe("The maximum number of cases to return. Default is 10."),
});

type SearchCasesToolArgs = z.infer<typeof searchCasesToolArgs>;

export const searchCasesTool = createTool({
    description: "Search for cases",
    args: searchCasesToolArgs,
    handler: async (ctx: ToolCtx, args: SearchCasesToolArgs) => {
        try {
            const { userId } = getUserAndCaseIds(ctx.userId as string);
            if (!userId) {
                return createErrorResponse("No autenticado");
            }

            const cases = await ctx.runQuery(internal.functions.cases.searchCases, {
                userId: userId as Id<"users">,
                query: args.query,
                limit: args.limit,
            });

            return createCasesResultsTemplate(cases, args.query, args.limit);

        } catch (error) {
            return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
    },
} as any);