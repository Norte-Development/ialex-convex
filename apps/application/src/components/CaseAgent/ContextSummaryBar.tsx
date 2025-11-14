import { useQuery } from "convex/react";
import { useCase } from "@/context/CaseContext";
import { useEscrito } from "@/context/EscritoContext";
import { usePage } from "@/context/PageContext";
import { useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import type { PillProps } from "./types/ui-types";
import type { ReferenceWithOriginal } from "./types/reference-types";
import type { ContextSummaryBarProps } from "./types/message-types";

function Pill({ label, value, icon, variant = "default" }: PillProps) {
  if (!value) return null;

  const baseClasses =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-white";
  const variantClasses =
    variant === "accent"
      ? "bg-blue-50 text-blue-700 border border-blue-200"
      : "bg-gray-50 text-gray-700 border border-gray-200";

  return (
    <div className={`${baseClasses}  ${variantClasses}`}>
      {icon && <span className="text-gray-500">{icon}</span>}
      <span className="text-gray-600">{label}:</span>
      <span className="truncate max-w-[10rem]">{value}</span>
    </div>
  );
}

export function ContextSummaryBar({
  references = [],
  onRemoveReference,
}: ContextSummaryBarProps) {
  const { caseTitle } = useCase();
  const { escritoId } = useEscrito();
  const { pageState } = usePage();
  const { documentId } = useParams();

  // Fetch escrito details if we have an escritoId
  const escrito = useQuery(
    api.functions.documents.getEscrito,
    escritoId ? { escritoId: escritoId as Id<"escritos"> } : "skip",
  );

  // Fetch document details if we have a documentId
  const document = useQuery(
    api.functions.documents.getDocument,
    documentId ? { documentId: documentId as Id<"documents"> } : "skip",
  );

  const page = pageState.currentPage || undefined;

  // Helper to get icon for reference type
  const getReferenceIcon = (type: string) => {
    switch (type) {
      case "client":
        return "👤";
      case "document":
        return "📄";
      case "escrito":
        return "📝";
      case "case":
        return "📁";
      default:
        return "🔗";
    }
  };

  // Don't show if no meaningful context
  if (!caseTitle && !escrito && !document && !page && references.length === 0) {
    return null;
  }

  return (
    <div className=" bg-transparent px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {caseTitle && (
          <Pill label="Caso" value={caseTitle} icon={<span>📁</span>} />
        )}
        {escrito && (
          <Pill label="Escrito" value={escrito.title} icon={<span>📝</span>} />
        )}
        {document && (
          <Pill label="Documento" value={document.title} icon={<span>📄</span>} />
        )}
        {page && page !== "unknown" && (
          <Pill
            label="Página"
            value={page.charAt(0).toUpperCase() + page.slice(1)}
          />
        )}

        {/* Show resolved @-references */}
        {references.map((ref: ReferenceWithOriginal, index: number) => (
          <div
            key={`${ref.type}-${ref.id}-${index}`}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200 group"
          >
            <span className="text-gray-500">{getReferenceIcon(ref.type)}</span>
            <span className="text-gray-600">@{ref.type}:</span>
            <span className="truncate max-w-[10rem]">{ref.name}</span>
            {onRemoveReference && (
              <button
                onClick={() => onRemoveReference(index)}
                className="ml-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Eliminar referencia"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ContextSummaryBar;
