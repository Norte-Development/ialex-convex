import { OpenRouterCompletionSettings } from "@openrouter/ai-sdk-provider";

export type OpenRouterModelConfig = {
  id: string;
  config?: OpenRouterCompletionSettings;
};

const FALLBACK_MODEL_BASE = "anthropic/claude-haiku-4.5";

const getPrimaryModelBase = (modelToUse: string): string => {
  if (modelToUse === "gpt-5") {
    return "openai/gpt-5.1";
  }

  // Default (free plan and any other slugs) → GPT-5-mini
  return "openai/gpt-5-mini";
};

const getReasoningConfig = (
  modelToUse: string,
): OpenRouterCompletionSettings | undefined => {
  if (modelToUse === "gpt-5") {
    return {
      reasoning: {
        enabled: true,
        effort: "low",
        exclude: false,
      },
    };
  }

  return undefined;
};

/**
 * Build the ordered list of OpenRouter models to try for the case workflow.
 *
 * This centralizes which models are primary vs. fallback so we can tweak
 * behavior without touching the agent logic.
 */
export const buildOpenRouterModelChain = (
  modelToUse: string,
  webSearch: boolean,
): OpenRouterModelConfig[] => {
  const models: OpenRouterModelConfig[] = [];

  const primaryBase = getPrimaryModelBase(modelToUse);
  const primaryConfig = getReasoningConfig(modelToUse);
  const primaryId = webSearch ? `${primaryBase}:online` : primaryBase;

  models.push({
    id: primaryId,
    config: primaryConfig,
  });

  // Only paid users (gpt-5) get a fallback model. Free users (gpt-5-mini)
  // should NOT silently upgrade to a more expensive model.
  if (modelToUse === "gpt-5") {
    const fallbackBase = FALLBACK_MODEL_BASE;
    const fallbackId = webSearch ? `${fallbackBase}:online` : fallbackBase;
    models.push({ id: fallbackId });
  }

  return models;
};

/**
 * Testing flag: when set to true, the backend will simulate a primary model
 * failure (for gpt-5) before calling the provider, so you can verify that
 * fallback streaming works without misconfiguring a real model ID.
 *
 * Toggle to `true` locally when you want to test fallback behavior.
 */
export const FORCE_PRIMARY_FALLBACK_TEST = false;


