import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { FileText, Calendar, User } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import { useNavigate } from "react-router-dom";

interface EscritoCardProps {
  escrito: {
    _id: Id<"escritos">;
    title: string;
    status: "borrador" | "terminado";
    wordCount?: number;
    lastEditedAt: number;
    _creationTime: number;
    createdBy: Id<"users">;
    caseId: Id<"cases">;
  };
}

export default function EscritoCard({ escrito }: EscritoCardProps) {
  const navigate = useNavigate();

  // Fetch author info
  const author = useQuery(api.functions.users.getUserById, {
    userId: escrito.createdBy,
  });

  const handleClick = () => {
    navigate(`/caso/${escrito.caseId}/escritos/${escrito._id}`);
  };

  const formatDate = (ts: number) =>
    format(new Date(ts), "dd/MM/yyyy", { locale: es });
  const formatAgo = (ts: number) =>
    formatDistanceToNow(new Date(ts), { addSuffix: true, locale: es });

  const statusLabel = escrito.status === "borrador" ? "Borrador" : "Terminado";
  const statusColor =
    escrito.status === "borrador"
      ? "bg-gray-100 text-gray-700 border-gray-300"
      : "bg-green-100 text-green-700 border-green-300";

  return (
    <div
      onClick={handleClick}
      className="group bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden flex flex-col h-full"
    >
      {/* Preview Section - Por ahora con placeholder */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 border-b border-gray-200 h-48 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Vista previa próximamente</p>
        </div>
      </div>

      {/* Info Section */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Title */}
        <h3 className="font-semibold text-gray-900 text-lg mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
          {escrito.title}
        </h3>

        {/* Status Badge */}
        <div className="mb-3">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}
          >
            {statusLabel}
          </span>
        </div>

        {/* Metadata */}
        <div className="mt-auto space-y-2 text-sm text-gray-600">
          {/* Author */}
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <span className="truncate">{author?.name || "Cargando..."}</span>
          </div>

          {/* Created Date */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>{formatDate(escrito._creationTime)}</span>
          </div>

          {/* Word Count */}
          {escrito.wordCount && (
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <span>{escrito.wordCount.toLocaleString()} palabras</span>
            </div>
          )}

          {/* Last Edited */}
          <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
            Modificado {formatAgo(escrito.lastEditedAt)}
          </div>
        </div>
      </div>
    </div>
  );
}
