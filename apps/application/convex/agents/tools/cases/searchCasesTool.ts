import { createTool, ToolCtx } from "@convex-dev/agent";
import { internal } from "../../../_generated/api";
import { z } from "zod";
import { createErrorResponse, getUserAndCaseIds } from "../shared/utils";
import { createCasesResultsTemplate } from "./templates";
import { Id } from "../../../_generated/dataModel";

export const searchCasesTool = createTool({
    description: "Search for cases",
    args: z.object({
        query: z.string().describe("The search query text to find relevant cases. Empty to get all cases."),
        limit: z.number().optional().describe("The maximum number of cases to return. Default is 10."),
    }).required({query: true}),
    handler: async (ctx: ToolCtx, args: any) => {
        try {
            const { query, limit } = args;
            const { userId } = getUserAndCaseIds(ctx.userId as string);
            if (!userId) {
                return createErrorResponse("No autenticado");
            }

            const cases = await ctx.runQuery(internal.functions.cases.searchCases, {
                userId: userId as Id<"users">,
                query: query,
                limit: limit,
            });

            return createCasesResultsTemplate(cases, query, limit);

        } catch (error) {
            return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
    },
} as any);