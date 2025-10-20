import { components } from "../../_generated/api";
import { Agent, stepCountIs } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";

import {
  searchCaseDocumentsTool,
  queryDocumentTool,
  editEscritoTool,
  getEscritoStatsTool,
  readEscritoTool,
  planAndTrackTool,
  markTaskCompleteTool,
  insertContentTool,
  manageEscritoTool,
  searchCaseClientsTool,
  searchTemplatesTool,

  legislationFindTool,
  legislationReadTool,

  searchLibraryDocumentsTool,
  listLibraryDocumentsTool,
  readLibraryDocumentTool,

  searchDoctrineTool,
  readDoctrineTool,
  listCaseDocumentsTool,
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
  name: "iAlex - Agente Legal de tu caso",
  languageModel: openai.responses('gpt-5'),
  stopWhen: stepCountIs(25),
  callSettings: {
    maxRetries: 3,
  },
  storageOptions: {
    saveMessages: "all"
  },
  contextOptions: {
    recentMessages: 20, // Reduced from 50 to prevent context bloat
    excludeToolMessages: true, // Exclude verbose tool messages to keep context lean
  },

  tools: {
    searchCaseDocumentos: searchCaseDocumentsTool,
    listCaseDocuments: listCaseDocumentsTool,
    queryDocumento: queryDocumentTool,
    editEscrito: editEscritoTool,
    getEscritoStats: getEscritoStatsTool,
    readEscrito: readEscritoTool,
    searchLegislation: legislationFindTool,
    readLegislation: legislationReadTool,
    planAndTrack: planAndTrackTool,
    markTaskComplete: markTaskCompleteTool,
    insertContent: insertContentTool,
    // manageEscrito: manageEscritoTool,
    searchClients: searchCaseClientsTool,
    searchTemplates: searchTemplatesTool,
    searchLibraryDocuments: searchLibraryDocumentsTool,
    listLibraryDocuments: listLibraryDocumentsTool,
    readLibraryDocument: readLibraryDocumentTool,
    searchDoctrine: searchDoctrineTool,
    readDoctrine: readDoctrineTool,
  }
});



