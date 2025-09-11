import { components } from "../_generated/api";
import { Agent, stepCountIs } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";

import {
  searchFallosTool,
  searchCaseDocumentsTool,
  readDocumentTool,
  listCaseDocumentsTool,
  queryDocumentTool,
  editEscritoTool,
  getEscritoTool,
} from "./tools/index";

/**
 * Main agent instance for the legal assistant system.
 * 
 * This agent is configured with:
 * - Name: "Legal Assistant Agent" for identification
 * - Chat model: GPT-4o-mini for cost-effective AI interactions
 * - Integration with Convex components for thread management
 * 
 * The agent handles all AI-powered conversations and legal assistance
 * functionality within the application.
 */
export const agent = new Agent(components.agent, {
  name: "Legal Assistant Agent",
  languageModel: openai.chat("gpt-5-mini"),
  stopWhen: stepCountIs(25),
  // Default call settings per 0.2.x: place maxRetries here
  callSettings: {
    maxRetries: 3,
  },
  // Ensure proper storage and context for v5
  storageOptions: {
    saveMessages: "all"
  },
  contextOptions: {
    recentMessages: 50,
    excludeToolMessages: false,
  },

  tools: {
    searchFallos: searchFallosTool,
    searchCaseDocuments: searchCaseDocumentsTool,
    readDocument: readDocumentTool,
    listCaseDocuments: listCaseDocumentsTool,
    queryDocument: queryDocumentTool,
    editEscrito: editEscritoTool,
    getEscrito: getEscritoTool,
  }
});



