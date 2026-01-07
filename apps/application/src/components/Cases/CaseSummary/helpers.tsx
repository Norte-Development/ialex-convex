import {
  FileText,
  Calendar,
  Send,
  Search,
  MessageCircle,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  Circle,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CaseSummaryContent } from "./types";

// ============================================
// HELPER: Parse JSON summary with fallback for legacy format
// ============================================
export function parseSummaryContent(
  summary: string,
): CaseSummaryContent | null {
  try {
    const parsed = JSON.parse(summary);
    if (parsed.keyFacts && parsed.currentStatus) {
      return parsed as CaseSummaryContent;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================
// HELPER: Get phase display name
// ============================================
export function getPhaseLabel(
  phase: CaseSummaryContent["currentStatus"]["phase"],
): string {
  const labels: Record<typeof phase, string> = {
    initial: "Inicio",
    investigation: "Investigación",
    negotiation: "Negociación",
    litigation: "Litigio",
    appeal: "Apelación",
    closed: "Cerrado",
  };
  return labels[phase] || phase;
}

// ============================================
// HELPER: Get urgency badge
// ============================================
export function getUrgencyBadge(
  urgency: CaseSummaryContent["currentStatus"]["urgency"],
) {
  switch (urgency) {
    case "urgent":
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" /> Urgente
        </Badge>
      );
    case "normal":
      return (
        <Badge variant="secondary" className="text-xs">
          Normal
        </Badge>
      );
    case "low":
      return (
        <Badge variant="outline" className="text-xs text-gray-500">
          Baja prioridad
        </Badge>
      );
  }
}

// ============================================
// HELPER: Get action status icon
// ============================================
export function getStatusIcon(status: "completed" | "in_progress" | "pending") {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "in_progress":
      return <Clock className="h-4 w-4 text-blue-600" />;
    case "pending":
      return <Circle className="h-4 w-4 text-gray-400" />;
  }
}

// ============================================
// HELPER: Get action type config for buttons
// ============================================
export function getActionConfig(
  actionType: CaseSummaryContent["nextSteps"][0]["actionType"],
) {
  const config: Record<
    typeof actionType,
    { icon: React.ElementType; label: string; color: string }
  > = {
    document: {
      icon: FileText,
      label: "Documento",
      color: "text-blue-600 border-blue-200 hover:bg-blue-50",
    },
    meeting: {
      icon: Calendar,
      label: "Agendar",
      color: "text-purple-600 border-purple-200 hover:bg-purple-50",
    },
    filing: {
      icon: Send,
      label: "Presentar",
      color: "text-green-600 border-green-200 hover:bg-green-50",
    },
    research: {
      icon: Search,
      label: "Investigar",
      color: "text-orange-600 border-orange-200 hover:bg-orange-50",
    },
    communication: {
      icon: MessageCircle,
      label: "Contactar",
      color: "text-pink-600 border-pink-200 hover:bg-pink-50",
    },
    other: {
      icon: MoreHorizontal,
      label: "Acción",
      color: "text-gray-600 border-gray-200 hover:bg-gray-50",
    },
  };
  return config[actionType] || config.other;
}

// ============================================
// HELPER: Generate prompt for agent based on action
// ============================================
export function generateActionPrompt(
  step: string,
  actionType: CaseSummaryContent["nextSteps"][0]["actionType"],
): string {
  const actionPrefixes: Record<typeof actionType, string> = {
    document: "Ayúdame a preparar el siguiente documento para este caso:",
    meeting: "Ayúdame a preparar una reunión sobre:",
    filing: "Ayúdame a redactar un escrito judicial para:",
    research: "Investiga sobre lo siguiente para este caso:",
    communication: "Ayúdame a redactar una comunicación sobre:",
    other: "Ayúdame con la siguiente tarea del caso:",
  };

  const prefix = actionPrefixes[actionType] || actionPrefixes.other;
  return `${prefix} ${step}`;
}

// ============================================
// HELPER: Get importance badge
// ============================================
export function getImportanceBadge(importance: "high" | "medium" | "low") {
  switch (importance) {
    case "high":
      return (
        <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-2" />
      );
    case "medium":
      return (
        <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-2" />
      );
    case "low":
      return (
        <span className="inline-block w-2 h-2 rounded-full bg-gray-400 mr-2" />
      );
  }
}

// ============================================
// HELPER: Get priority badge
// ============================================
export function getPriorityBadge(priority: "high" | "medium" | "low") {
  switch (priority) {
    case "high":
      return (
        <Badge variant="destructive" className="text-xs">
          Alta
        </Badge>
      );
    case "medium":
      return (
        <Badge variant="secondary" className="text-xs">
          Media
        </Badge>
      );
    case "low":
      return (
        <Badge variant="outline" className="text-xs">
          Baja
        </Badge>
      );
  }
}
