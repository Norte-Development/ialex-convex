export interface AiLimitErrorInfo {
  isAiLimit: boolean;
  isTeamLimit: boolean;
  message?: string;
}

/**
 * Detects whether an error corresponds to the monthly AI message limit.
 *
 * This relies on the backend error messages thrown from Convex agents:
 * - User scope:
 *   "Has alcanzado el límite de mensajes de IA. Compra créditos o actualiza a Premium para mensajes ilimitados."
 * - Team scope:
 *   "El equipo ha alcanzado el límite de mensajes de IA este mes."
 *
 * If backend errors migrate to structured codes in the future, prefer those here.
 */
export function parseAiLimitError(error: unknown): AiLimitErrorInfo {
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

