import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { usePermissions } from "@/context/CasePermissionsContext";
import { useChatbot } from "@/context/ChatbotContext";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CaseSummaryPanelProps } from "./types";
import { parseSummaryContent } from "./helpers";
import { StructuredSummaryDisplay } from "./StructuredSummaryDisplay";
import { LegacySummaryDisplay } from "./LegacySummaryDisplay";

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
  const { openChatbotWithPrompt } = useChatbot();

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
              isStructured && parsedContent ? (
                <StructuredSummaryDisplay
                  content={parsedContent}
                  onActionClick={openChatbotWithPrompt}
                />
              ) : (
                <LegacySummaryDisplay summary={existingSummary!} />
              )
            ) : (
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
