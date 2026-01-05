import { CaseNote, CaseNoteType } from "@/types/caseNotes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Star, User, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface NoteCardProps {
  note: CaseNote;
  onEdit: () => void;
  onDelete: () => void;
}

const NOTE_TYPES = [
  { value: "decisión", label: "Decisión", color: "bg-blue-50 text-blue-700 border-blue-200" },
  {
    value: "recordatorio",
    label: "Recordatorio",
    color: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  { value: "acuerdo", label: "Acuerdo", color: "bg-green-50 text-green-700 border-green-200" },
  {
    value: "información",
    label: "Información",
    color: "bg-gray-50 text-gray-700 border-gray-200",
  },
  { value: "otro", label: "Otro", color: "bg-purple-50 text-purple-700 border-purple-200" },
] as const;

export default function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  const typeBadge = NOTE_TYPES.find((t) => t.value === note.type) || NOTE_TYPES[4];
  const timeAgo = formatDistanceToNow(
    new Date(note.lastEditedAt || note._creationTime),
    { addSuffix: true, locale: es }
  );

  return (
    <div
      className={`group border rounded-lg p-4 hover:shadow-sm transition-all ${
        note.isImportant ? "border-yellow-300 bg-yellow-50/30" : "border-gray-200 bg-white"
      }`}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {note.isImportant && (
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 flex-shrink-0" />
            )}
            {note.title && (
              <h3 className="font-medium text-gray-900 text-sm truncate">
                {note.title}
              </h3>
            )}
            <Badge className={`text-xs ${typeBadge.color} border`}>
              {typeBadge.label}
            </Badge>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 p-0">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">
          {note.content}
        </p>

        {/* Footer */}
        <div className="flex items-center gap-3 text-xs text-gray-500 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span className="truncate max-w-[120px]">{note.creatorName}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{timeAgo}</span>
          </div>
          {note.updaterName && note.updaterName !== note.creatorName && (
            <span className="text-gray-400">
              Editado por: <span className="text-gray-600 font-medium">{note.updaterName}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
