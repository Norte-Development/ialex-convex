import { createTool } from "@convex-dev/agent";
import { internal } from "../../../_generated/api";
import { z } from "zod";


export const readDoctrineTool = createTool({
    description: "Tool for reading and retrieving doctrine information. Supports reading by URL. Returns doctrine content without raw content or IDs. Perfect for reading doctrine before applying it to escritos.",
    args: z.object({
        url: z.string().describe("URL of the doctrine to read"),
    }).required({url: true}),
    handler: async (ctx, args) => {
        const result: string[] = await ctx.runAction(internal.agents.tools.doctrine.utils.crawlUrl, {
            url: args.url,
        });
        return result;
    }
})