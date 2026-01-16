import {
  Briefcase,
  User,
  FileText,
  ScrollText,
  FileCode,
  Library,
} from "lucide-react";
import { SearchResultType } from "@/hooks/useGlobalSearch";
import { cn } from "@/lib/utils";

interface SearchResultItemProps {
  type: SearchResultType;
  title?: string;
  metadata?: {
    status?: string;
    category?: string;
    naturalezaJuridica?: string;
    email?: string;
    documentType?: string;
    templateType?: string;
  };
  onClick: () => void;
  searchQuery: string;
}

const getTypeIcon = (type: SearchResultType) => {
  switch (type) {
    case "case":
      return <Briefcase className="w-4 h-4" />;
    case "client":
      return <User className="w-4 h-4" />;
    case "document":
      return <FileText className="w-4 h-4" />;
    case "escrito":
      return <ScrollText className="w-4 h-4" />;
    case "template":
      return <FileCode className="w-4 h-4" />;
    case "libraryDocument":
      return <Library className="w-4 h-4" />;
  }
};

const getTypeLabel = (type: SearchResultType): string => {
  switch (type) {
    case "case":
      return "Caso";
    case "client":
      return "Cliente";
    case "document":
      return "Documento";
    case "escrito":
      return "Escrito";
    case "template":
      return "Modelo";
    case "libraryDocument":
      return "Biblioteca";
  }
};

const highlightMatch = (text: string | undefined | null, query: string) => {
  if (!text) return null;
  if (!query.trim()) return text;

  const regex = new RegExp(`(${query})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? (
      <span key={index} className="font-semibold text-foreground">
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
};

export default function SearchResultItem({
  type,
  title,
  metadata,
  onClick,
  searchQuery,
}: SearchResultItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 px-3 py-2.5 rounded-md transition-colors",
        "hover:bg-accent text-left",
        "focus:outline-none focus:bg-accent",
      )}
    >
      <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
        {getTypeIcon(type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground font-medium">
            {getTypeLabel(type)}
          </span>
        </div>
        <div className="text-sm mt-0.5 text-foreground truncate">
          {title ? highlightMatch(title, searchQuery) : "Sin título"}
        </div>
        {metadata && (
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            {metadata.status && (
              <span className="capitalize">{metadata.status}</span>
            )}
            {metadata.category && (
              <>
                {metadata.status && <span>•</span>}
                <span>{metadata.category}</span>
              </>
            )}
            {metadata.naturalezaJuridica && (
              <span>
                {metadata.naturalezaJuridica === "juridica"
                  ? "P. Jurídica"
                  : "P. Humana"}
              </span>
            )}
            {metadata.email && (
              <>
                <span>•</span>
                <span className="truncate">{metadata.email}</span>
              </>
            )}
            {metadata.documentType && (
              <span className="capitalize">{metadata.documentType}</span>
            )}
            {metadata.templateType && (
              <span className="capitalize">{metadata.templateType}</span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
