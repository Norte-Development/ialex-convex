import { components } from "../_generated/api";
import { Agent } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { 
  searchLegislationTool, 
  searchFallosTool, 
  searchCaseDocumentsTool, 
  readDocumentTool, 
  listCaseDocumentsTool, 
  queryDocumentTool 
} from "./tools";

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
  chat: openai.chat("gpt-4o"),
  tools: {
    searchLegislation: searchLegislationTool,
    searchFallos: searchFallosTool,
    searchCaseDocuments: searchCaseDocumentsTool,
    readDocument: readDocumentTool,
    listCaseDocuments: listCaseDocumentsTool,
    queryDocument: queryDocumentTool
  }
});



