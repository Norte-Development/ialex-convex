import { components } from "../../_generated/api";
import { Agent, stepCountIs } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import {
  legislationFindTool,
  legislationReadTool,
  searchTemplatesTool,
} from "../tools";

import {
  searchLibraryDocumentsTool,
  listLibraryDocumentsTool,
  readLibraryDocumentTool,
  legislationFindTool,
  legislationReadTool,
  searchDoctrineTool,
  readDoctrineTool,
} from "../tools";

/**
 * Main agent instance for the legal assistant system.
 * 
 * This agent is configured with:
 * - Name: "iAlex - Agente Legal" for identification
 * - Chat model: GPT-5-mini for cost-effective AI interactions
 * - Integration with Convex components for thread management
 * 
 * The agent handles all AI-powered conversations and legal assistance
 * functionality within the application.
 */
export const agent = new Agent(components.agent, {
  name: "iAlex - Agente Legal General",
  languageModel: openai.responses('gpt-5-mini'),
  stopWhen: stepCountIs(25),
  callSettings: {
    maxRetries: 3,
  },
  storageOptions: {
    saveMessages: "all"
  },
  contextOptions: {
    recentMessages: 50,
    excludeToolMessages: false,
  },

  tools: {
    searchLibraryDocuments: searchLibraryDocumentsTool,
    listLibraryDocuments: listLibraryDocumentsTool,
    readLibraryDocument: readLibraryDocumentTool,
    searchLegislation: legislationFindTool,
    readLegislation: legislationReadTool,
    searchDoctrine: searchDoctrineTool,
    readDoctrine: readDoctrineTool,
  }
});
