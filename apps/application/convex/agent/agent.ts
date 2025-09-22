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
  getEscritoStatsTool,
  readEscritoTool,
  legislationFindTool,
  legislationReadTool,
  planAndTrackTool,
} from "./tools/index";

/**
 * Main agent instance for the legal assistant system.
 * 
 * This agent is configured with:
 * - Name: "Legal Assistant Agent" for identification
 * - Chat model: GPT-5-mini for cost-effective AI interactions
 * - Integration with Convex components for thread management
 * 
 * The agent handles all AI-powered conversations and legal assistance
 * functionality within the application.
 */
export const agent = new Agent(components.agent, {
  name: "Legal Assistant Agent",
  languageModel: openai.responses('gpt-5-mini'),
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
    searchCaseDocumentos: searchCaseDocumentsTool,
    readDocumento: readDocumentTool,
    listCaseDocumentos: listCaseDocumentsTool,
    queryDocumento: queryDocumentTool,
    editEscrito: editEscritoTool,
    getEscritoStats: getEscritoStatsTool,
    readEscrito: readEscritoTool,
    searchLegislation: legislationFindTool,
    readLegislation: legislationReadTool,
    planAndTrack: planAndTrackTool,
  }
});



