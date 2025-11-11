import { FileText, X } from "lucide-react";
import type { SelectionMeta } from "./types/reference-types";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface SelectionChipProps {
  selection: SelectionMeta;
  className?: string;
  onRemove?: () => void;
}

export function SelectionChip({ selection, className, onRemove }: SelectionChipProps) {
  const escrito = useQuery(api.functions.documents.getEscrito, {
    escritoId: selection.escritoId,
  });

  const documentName = escrito?.title || "Documento";
  const rangeText = `${selection.range.from}-${selection.range.to}`;

  const handleClick = () => {
    window.dispatchEvent(
      new CustomEvent("ialex:scrollToEscritoRange", {
        detail: {
          escritoId: selection.escritoId,
          from: selection.range.from,
          to: selection.range.to,
        },
      })
    );
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs shadow-sm",
        className
      )}
    >
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 text-left hover:opacity-80 transition-opacity"
      >
        <FileText className="h-3 w-3 text-gray-500 shrink-0" />
        <span className="text-gray-700 font-medium">{documentName}</span>
        <span className="text-gray-500">({rangeText})</span>
      </button>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors p-0.5"
          aria-label="Eliminar selección del contexto"
          title="Eliminar selección del contexto"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

