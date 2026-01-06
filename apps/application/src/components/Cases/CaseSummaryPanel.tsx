import { useState } from "react";
import { useMutation, useAction } from "convex/react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  ChevronDown,
  Loader2,
  Copy,
  Check,
  Edit2,
  Save,
  X,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CaseSummaryPanelProps {
  caseId: Id<"cases">;
  existingSummary?: string;
  summaryUpdatedAt?: number;
  manuallyEdited?: boolean;
}

export function CaseSummaryPanel({
  caseId,
  existingSummary,
  summaryUpdatedAt,
  manuallyEdited,
}: CaseSummaryPanelProps) {
  const [isOpen, setIsOpen] = useState(false); // Colapsado por defecto
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");
  const [copied, setCopied] = useState(false);

  const permissions = usePermissions();
  const canEditCase = permissions.can.editCase;

  const generateSummary = useAction(api.functions.caseSummary.generateCaseSummary);
  const updateSummary = useMutation(api.functions.caseSummary.updateCaseSummary);

  const hasSummary = !!existingSummary;

  // Check if summary is obsolete (more than 7 days)
  const isObsolete = summaryUpdatedAt &&
    Date.now() - summaryUpdatedAt > 7 * 24 * 60 * 60 * 1000;

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
    if (!canEditCase) {
      toast.error("No tienes permisos para generar resúmenes");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateSummary({ caseId });

      if (result.success) {
        toast.success("Resumen generado exitosamente");
        // Page will re-render with new data via Convex reactivity
      } else {
        toast.error(result.message || "Error al generar resumen");
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al generar resumen. Inténtalo nuevamente."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditSummary = () => {
    setEditedSummary(parseSummary(existingSummary!));
    setIsEditing(true);
  };

  const handleSaveSummary = async () => {
    if (!canEditCase) {
      toast.error("No tienes permisos para editar resúmenes");
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateSummary({
        caseId,
        summary: editedSummary,
      });

      if (result.success) {
        toast.success("Resumen actualizado exitosamente");
        setIsEditing(false);
        // Page will re-render with new data via Convex reactivity
      } else {
        toast.error(result.message || "Error al actualizar resumen");
      }
    } catch (error) {
      console.error("Error updating summary:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al actualizar resumen. Inténtalo nuevamente."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedSummary("");
    setIsEditing(false);
  };

  const handleCopyToClipboard = async () => {
    try {
      const textToCopy = isEditing ? editedSummary : parseSummary(existingSummary || "");
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success("Resumen copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast.error("Error al copiar al portapapeles");
    }
  };

  // Parse summary if it exists (extract content from <summary> tags)
  const parseSummary = (summary: string) => {
    const match = summary.match(/<summary>([\s\S]*)<\/summary>/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return summary; // Return as-is if no tags found
  };

  // Format summary for display (convert markdown-style headers to styled elements)
  const formatSummaryDisplay = (summary: string) => {
    const parsed = parseSummary(summary);
    // Convert ## headers to styled h3
    let formatted = parsed.replace(/^## (.+)$/gm, '<h3 class="text-lg font-semibold text-gray-900 mt-4 mb-2">$1</h3>');
    // Convert bullet points with • to list items
    formatted = formatted.replace(/^• (.+)$/gm, '<li class="ml-4 text-gray-700">$1</li>');
    // Convert numbered lists
    formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 text-gray-700 list-decimal">$1</li>');
    // Convert plain paragraphs (lines that don't start with special chars)
    formatted = formatted.replace(/^(?!<h3|<li)(.+)$/gm, '<p class="text-gray-700 mb-2">$1</p>');

    return formatted;
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
                  <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 flex items-center gap-1">
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
            {permissions.can.editCase && !isEditing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateSummary}
                  disabled={isGenerating || isSaving}
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
                {hasSummary && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEditSummary}
                    disabled={isGenerating || isSaving}
                    className="text-xs"
                  >
                    <Edit2 className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                )}
              </>
            )}

            {hasSummary && !isEditing && (
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
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isOpen && "transform rotate-180"
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Content */}
        <CollapsibleContent>
          <div className="p-4">
            {isEditing ? (
              // Edit Mode
              <div className="space-y-3">
                <Textarea
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  placeholder="Edita el resumen del caso..."
                  className="min-h-[300px] font-mono text-sm"
                  disabled={isSaving}
                />
                <div className="flex items-center gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveSummary}
                    disabled={isSaving || !editedSummary.trim()}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-1" />
                        Guardar cambios
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : hasSummary ? (
              // Display Mode
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: formatSummaryDisplay(existingSummary!),
                }}
              />
            ) : (
              // Empty State
              <div className="text-center py-12">
                <Sparkles className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  Sin resumen generado
                </h4>
                <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                  Genera un resumen inteligente del caso con los hechos clave, acciones relevantes,
                  estado actual y próximos pasos sugeridos.
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
