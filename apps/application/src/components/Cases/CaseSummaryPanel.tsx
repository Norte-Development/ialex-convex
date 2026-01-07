import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { usePermissions } from "@/context/CasePermissionsContext";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  ChevronDown,
  Loader2,
  Copy,
  Check,
  AlertCircle,
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
import { cn } from "@/lib/utils";

// ============================================
// TYPE: Structured Case Summary (matches Zod schema in backend)
// ============================================
interface CaseSummaryContent {
  keyFacts: Array<{ fact: string; importance: "high" | "medium" | "low" }>;
  relevantActions: Array<{
    action: string;
    date: string;
    status: "completed" | "in_progress" | "pending";
  }>;
  currentStatus: {
    summary: string;
    phase:
      | "initial"
      | "investigation"
      | "negotiation"
      | "litigation"
      | "appeal"
      | "closed";
    urgency: "urgent" | "normal" | "low";
  };
  nextSteps: Array<{
    step: string;
    priority: "high" | "medium" | "low";
    actionType:
      | "document"
      | "meeting"
      | "filing"
      | "research"
      | "communication"
      | "other";
    deadline: string;
  }>;
}

interface CaseSummaryPanelProps {
  caseId: Id<"cases">;
  existingSummary?: string;
  summaryUpdatedAt?: number;
  manuallyEdited?: boolean;
}

// ============================================
// HELPER: Parse JSON summary with fallback for legacy format
// ============================================
function parseSummaryContent(summary: string): CaseSummaryContent | null {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(summary);
    if (parsed.keyFacts && parsed.currentStatus) {
      return parsed as CaseSummaryContent;
    }
    return null;
  } catch {
    // Not valid JSON - legacy format
    return null;
  }
}

// ============================================
// HELPER: Get phase display name
// ============================================
function getPhaseLabel(
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
// HELPER: Get urgency badge color
// ============================================
function getUrgencyBadge(
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
function getStatusIcon(status: "completed" | "in_progress" | "pending") {
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
function getActionConfig(
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
// HELPER: Get importance badge
// ============================================
function getImportanceBadge(importance: "high" | "medium" | "low") {
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
function getPriorityBadge(priority: "high" | "medium" | "low") {
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

// ============================================
// SUB-COMPONENT: Structured Summary Display
// ============================================
function StructuredSummaryDisplay({
  content,
}: {
  content: CaseSummaryContent;
}) {
  return (
    <div className="space-y-6">
      {/* Current Status Card */}
      <div className="bg-gradient-to-r from-tertiary/5 to-tertiary/10 rounded-lg p-4 border border-tertiary/20">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-tertiary" />
            Estado Actual
          </h4>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {getPhaseLabel(content.currentStatus.phase)}
            </Badge>
            {getUrgencyBadge(content.currentStatus.urgency)}
          </div>
        </div>
        <p className="text-gray-700 text-sm leading-relaxed">
          {content.currentStatus.summary}
        </p>
      </div>

      {/* Key Facts */}
      {content.keyFacts.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-tertiary" />
            Hechos Clave
          </h4>
          <ul className="space-y-2">
            {content.keyFacts.map((item, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 rounded-md p-2"
              >
                {getImportanceBadge(item.importance)}
                <span>{item.fact}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Relevant Actions */}
      {content.relevantActions.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-tertiary" />
            Acciones Relevantes
          </h4>
          <ul className="space-y-2">
            {content.relevantActions.map((item, index) => (
              <li
                key={index}
                className="flex items-center gap-3 text-sm text-gray-700 bg-gray-50 rounded-md p-2"
              >
                {getStatusIcon(item.status)}
                <span className="flex-1">{item.action}</span>
                {item.date && (
                  <span className="text-xs text-gray-500">{item.date}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Steps */}
      {content.nextSteps.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-tertiary" />
            Próximos Pasos
          </h4>
          <div className="space-y-3">
            {content.nextSteps.map((item, index) => {
              const actionConfig = getActionConfig(item.actionType);
              const Icon = actionConfig.icon;

              return (
                <div
                  key={index}
                  className="flex items-start gap-3 bg-white border rounded-lg p-3 shadow-sm"
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full border",
                      actionConfig.color,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-gray-900">
                        {item.step}
                      </span>
                      {getPriorityBadge(item.priority)}
                    </div>
                    {item.deadline && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.deadline}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("text-xs gap-1", actionConfig.color)}
                  >
                    <Icon className="h-3 w-3" />
                    {actionConfig.label}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENT: Legacy Summary Display (fallback)
// ============================================
function LegacySummaryDisplay({ summary }: { summary: string }) {
  // Extract content from <summary> tags if present
  const match = summary.match(/<summary>([\s\S]*)<\/summary>/);
  const content = match && match[1] ? match[1].trim() : summary;

  // Convert markdown-style headers to styled elements
  let formatted = content.replace(
    /^## (.+)$/gm,
    '<h3 class="text-lg font-semibold text-gray-900 mt-4 mb-2">$1</h3>',
  );
  formatted = formatted.replace(
    /^• (.+)$/gm,
    '<li class="ml-4 text-gray-700">$1</li>',
  );
  formatted = formatted.replace(
    /^\d+\. (.+)$/gm,
    '<li class="ml-4 text-gray-700 list-decimal">$1</li>',
  );
  formatted = formatted.replace(
    /^(?!<h3|<li)(.+)$/gm,
    '<p class="text-gray-700 mb-2">$1</p>',
  );

  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: formatted }}
    />
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
export function CaseSummaryPanel({
  caseId,
  existingSummary,
  summaryUpdatedAt,
  manuallyEdited,
}: CaseSummaryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const permissions = usePermissions();

  const generateSummary = useAction(
    api.functions.caseSummary.generateCaseSummary,
  );

  const hasSummary = !!existingSummary;
  const parsedContent = existingSummary
    ? parseSummaryContent(existingSummary)
    : null;
  const isStructured = parsedContent !== null;

  // Check if summary is obsolete (more than 7 days)
  const isObsolete =
    summaryUpdatedAt && Date.now() - summaryUpdatedAt > 7 * 24 * 60 * 60 * 1000;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      const result = await generateSummary({ caseId });

      if (result.success) {
        toast.success("Resumen generado exitosamente");
      } else {
        toast.error(result.message || "Error al generar resumen");
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al generar resumen. Inténtalo nuevamente.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      // For structured content, format nicely for clipboard
      let textToCopy = existingSummary || "";
      if (parsedContent) {
        const lines: string[] = [];
        lines.push("## Estado Actual");
        lines.push(parsedContent.currentStatus.summary);
        lines.push("");
        lines.push("## Hechos Clave");
        parsedContent.keyFacts.forEach((f) => lines.push(`• ${f.fact}`));
        lines.push("");
        lines.push("## Acciones Relevantes");
        parsedContent.relevantActions.forEach((a) =>
          lines.push(`• ${a.action}`),
        );
        lines.push("");
        lines.push("## Próximos Pasos");
        parsedContent.nextSteps.forEach((s, i) =>
          lines.push(`${i + 1}. ${s.step}`),
        );
        textToCopy = lines.join("\n");
      }

      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success("Resumen copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast.error("Error al copiar al portapapeles");
    }
  };

  return (
    <div className="rounded-lg border border-tertiary/20 bg-white shadow-sm">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-tertiary/10 bg-gray-50">
          <div className="flex items-center gap-3 flex-1">
            <Sparkles className="h-5 w-5 text-tertiary flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">
                  Resumen del Caso
                </h3>
                {manuallyEdited && (
                  <Badge variant="secondary" className="text-xs">
                    Editado manualmente
                  </Badge>
                )}
                {isObsolete && hasSummary && (
                  <Badge
                    variant="outline"
                    className="text-xs text-orange-600 border-orange-300 flex items-center gap-1"
                  >
                    <AlertCircle className="h-3 w-3" />
                    Desactualizado
                  </Badge>
                )}
              </div>
              {hasSummary && summaryUpdatedAt && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Actualizado: {formatDate(summaryUpdatedAt)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {permissions.can.editCase && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateSummary}
                disabled={isGenerating}
                className="text-xs"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 mr-1" />
                    {hasSummary ? "Actualizar" : "Generar"}
                  </>
                )}
              </Button>
            )}

            {hasSummary && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyToClipboard}
                disabled={copied}
                className="text-xs"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar
                  </>
                )}
              </Button>
            )}

            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isOpen && "transform rotate-180",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Content */}
        <CollapsibleContent>
          <div className="p-4">
            {hasSummary ? (
              // Display Mode - Check if structured or legacy
              isStructured && parsedContent ? (
                <StructuredSummaryDisplay content={parsedContent} />
              ) : (
                <LegacySummaryDisplay summary={existingSummary!} />
              )
            ) : (
              // Empty State
              <div className="text-center py-12">
                <Sparkles className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  Sin resumen generado
                </h4>
                <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                  Genera un resumen inteligente del caso con los hechos clave,
                  acciones relevantes, estado actual y próximos pasos sugeridos.
                </p>
                {permissions.can.editCase && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateSummary}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generar Resumen
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
