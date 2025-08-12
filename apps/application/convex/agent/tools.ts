import { createTool, ToolCtx, getThreadMetadata} from "@convex-dev/agent";
import { components } from "../_generated/api";
import { z } from "zod";
import { rag } from "../rag/rag";
import { getCurrentUserFromAuth } from "../auth_utils";

export const searchLegislationTool = createTool({
    description: "Search legal legislation using hybrid search (dense + sparse embeddings). Supports filtering by category, date range, and jurisdiction.",
    args: z.object({
        query: z.string().describe("The search query text"),
        jurisdiccion: z.string().optional().default("nacional").describe("Jurisdiction to search in (e.g., 'nacional', 'provincial'). Defaults to 'nacional'"),
        category: z.union([
            z.string(),
            z.array(z.string())
        ]).optional().describe("Category or categories to filter by (e.g., 'disposicion', 'ley', 'decreto')"),
        startDate: z.string().optional().describe("Start date for date range filter (ISO format or parseable date string)"),
        endDate: z.string().optional().describe("End date for date range filter (ISO format or parseable date string)")
    }),
    handler: async (ctx: any, args: any) => {
      try {
        const response = await fetch(`${process.env.SEARCH_API_URL}/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.SEARCH_API_KEY!
            },
            body: JSON.stringify(args)
        });
        
        if (!response.ok) {
            return {
                results: [],
                error: "Error searching legislation. Try again later."
            }
        }
        
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Error searching legislation:", error);
        return {
          results: [],
          error: "Error searching legislation. Try again later."
        }
      }
    },
} as any);

// export const searchDocumentsTool = createTool({
//     description: "Search user and team documents using hybrid search. Useful for finding specific documents within the legal case management system.",
//     args: z.object({
//         query: z.string().describe("The search query text to find relevant documents"),
//         user_id: z.string().optional().describe("Filter documents by specific user ID"),
//         team_id: z.string().optional().describe("Filter documents by specific team ID"),
//         limit: z.number().optional().default(30).describe("Maximum number of results to return (default: 30)")
//     }),
//     handler: async (ctx: any, args: any) => {
//         const response = await fetch(`${process.env.FLASK_API_URL}/search_documents`, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'X-API-Key': process.env.SEARCH_API_KEY!
//             },
//             body: JSON.stringify(args)
//         });
        
//         if (!response.ok) {
//             throw new Error(`Document search failed: ${response.statusText}`);
//         }
        
//         const data = await response.json();
//         return data;
//     },
// } as any);

export const searchFallosTool = createTool({
    description: "Search court decisions and legal precedents (fallos) using dense embeddings. Useful for finding relevant case law and judicial decisions.",
    args: z.object({
        query: z.string().describe("The search query text to find relevant court decisions"),
        limit: z.number().optional().default(10).describe("Maximum number of results to return (default: 10)")
    }),
    handler: async (ctx: any, args: any) => {
        const response = await fetch(`${process.env.SEARCH_API_URL}/search_fallos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.SEARCH_API_KEY!
            },
            body: JSON.stringify(args)
        });
        
        if (!response.ok) {
            throw new Error(`Fallos search failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
    },
} as any);


export const searchCaseDocumentsTool = createTool({
  description: "Search case documents using dense embeddings. Useful for finding relevant case documents.",
  args: z.object({
    query: z.string().describe("The search query text to find relevant case documents"),
    limit: z.number().optional().default(10).describe("Maximum number of results to return (default: 10)")
  }),
  handler: async (ctx: ToolCtx, {query, limit}: {query: string, limit: number}) => {
    // Use userId directly from ctx instead of getCurrentUserFromAuth
    if (!ctx.userId) {
      throw new Error("Not authenticated");
    }
    
    // Extract caseId from thread metadata
    if (!ctx.threadId) {
      throw new Error("No thread context available");
    }
    
    const { userId: threadUserId } = await getThreadMetadata(ctx, components.agent, { threadId: ctx.threadId });
    
    // Extract caseId from threadUserId format: "case:${caseId}_${userId}"
    if (!threadUserId?.startsWith("case:")) {
      throw new Error("This tool can only be used within a case context");
    }
    
    const caseId = threadUserId.substring(5).split("_")[0]; // Remove "case:" prefix and get caseId part
    console.log("caseId", caseId);
    // Construct the case-specific namespace using the same pattern as other functions
    const namespace = `case-${caseId}`;
    const context = await rag.search(ctx, {namespace, query});
    return context.text;
  }
} as any);
