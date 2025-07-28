import { components } from "../_generated/api";
import { Agent } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { v } from "convex/values";
import { action } from "../_generated/server";

export const agent = new Agent(components.agent, {
  name: "Legal Assistant Agent",
  chat: openai.chat("gpt-4o-mini")
});



