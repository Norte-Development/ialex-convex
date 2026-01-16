export interface AiLimitErrorInfo {
  isAiLimit: boolean;
  isTeamLimit: boolean;
  message?: string;
}

/**
 * Type guard for ConvexError data structure
 */
interface ConvexErrorData {
  code: string;
  message: string;
  isTeamLimit?: boolean;
}

/**
 * Extracts ConvexError data from an error object.
 * ConvexError on the frontend has a `data` property containing the error payload.
 */
function getConvexErrorData(error: unknown): ConvexErrorData | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  // Check if it's a ConvexError (has a data property with code and message)
  const errorObj = error as { data?: unknown };
  if (errorObj.data && typeof errorObj.data === "object") {
    const data = errorObj.data as Record<string, unknown>;
    if (typeof data.code === "string" && typeof data.message === "string") {
      return {
        code: data.code,
        message: data.message,
        isTeamLimit: typeof data.isTeamLimit === "boolean" ? data.isTeamLimit : undefined,
      };
    }
  }

  return null;
}

/**
 * Detects whether an error corresponds to the monthly AI message limit.
 *
 * Supports both structured ConvexError format and legacy string-based errors:
 * - Structured (preferred): ConvexError with code "AI_LIMIT_EXCEEDED"
 * - Legacy user scope:
 *   "Has alcanzado el límite de mensajes de IA. Compra créditos o actualiza a Premium para mensajes ilimitados."
 * - Legacy team scope:
 *   "El equipo ha alcanzado el límite de mensajes de IA este mes."
 */
export function parseAiLimitError(error: unknown): AiLimitErrorInfo {
  // First, check for structured ConvexError format
  const convexErrorData = getConvexErrorData(error);
  if (convexErrorData) {
    if (convexErrorData.code === "AI_LIMIT_EXCEEDED") {
      return {
        isAiLimit: true,
        isTeamLimit: convexErrorData.isTeamLimit ?? false,
        message: convexErrorData.message,
      };
    }
    // Return the message from ConvexError even if it's not an AI limit error
    return {
      isAiLimit: false,
      isTeamLimit: false,
      message: convexErrorData.message,
    };
  }

  // Fallback to legacy string-based error detection
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : undefined;

  if (!message) {
    return { isAiLimit: false, isTeamLimit: false };
  }

  if (message.includes("El equipo ha alcanzado el límite de mensajes de IA este mes")) {
    return {
      isAiLimit: true,
      isTeamLimit: true,
      message,
    };
  }

  if (
    message.includes(
      "Has alcanzado el límite de mensajes de IA. Compra créditos o actualiza a Premium para mensajes ilimitados.",
    )
  ) {
    return {
      isAiLimit: true,
      isTeamLimit: false,
      message,
    };
  }

  return { isAiLimit: false, isTeamLimit: false, message };
}

