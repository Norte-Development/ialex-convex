import { components } from "../../_generated/api";
import { Agent, stepCountIs } from "@convex-dev/agent";
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

import {
    searchLibraryDocumentsTool,
    listLibraryDocumentsTool,
    readLibraryDocumentTool,
    legislationFindTool,
    legislationReadTool,
    searchDoctrineTool,
    readDoctrineTool,
    searchFallosTool,
    readFallosTool,
  } from "../tools";

const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
});


export const agent = new Agent(components.agent, {
    name: "iAlex - Agente de WhatsApp",
    stopWhen: stepCountIs(25),
    languageModel: openrouter('openai/gpt-5-mini'),
    contextOptions:{
        recentMessages: 50,
    },
    tools: {
        searchLibraryDocuments: searchLibraryDocumentsTool,
        listLibraryDocuments: listLibraryDocumentsTool,
        readLibraryDocument: readLibraryDocumentTool,
        searchLegislation: legislationFindTool,
        readLegislation: legislationReadTool,
        searchDoctrine: searchDoctrineTool,
        readDoctrine: readDoctrineTool,
        searchFallos: searchFallosTool,
        readFallos: readFallosTool,
    }
})