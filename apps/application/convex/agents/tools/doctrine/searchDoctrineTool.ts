import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../../_generated/api";
import { z } from "zod";
import { createErrorResponse, validateStringParam } from "../shared/utils";
import { Id } from "../../../_generated/dataModel";
import { SearchResultWeb } from "@mendable/firecrawl-js";

export const searchDoctrineTool = createTool({
    description: "Tool for searching and retrieving doctrine information. Supports searching by name, category, content type, or getting specific doctrine. Returns doctrine summaries and brief descriptions without raw content or IDs. Perfect for finding and understanding doctrine before applying it to escritos.",
    args: z.object({
        searchTerm: z.string().describe("Search term to filter doctrine by name or description"),
    }).required({searchTerm: true}),
    handler: async (ctx, args) => {
        const results = await ctx.runAction(internal.agents.tools.doctrine.utils.searchDoctrine, {
            query: args.searchTerm
        });
        
        let resultsString = "";
    
        results.forEach(r => {
            r.web?.forEach((w) => {
                resultsString += `- ${'title' in w ? w.title : 'N/A'}\n ${'URL' in w ? w.URL : 'url' in w ? w.url : 'N/A'}\n`;
            })
        })
    
        return resultsString;
    }
})