import { useEffect, useRef } from "react";
import SearchResultItem from "./SearchResultItem";
import { GroupedSearchResults } from "@/hooks/useGlobalSearch";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchDropdownProps {
  isOpen: boolean;
  isLoading: boolean;
  results: GroupedSearchResults | undefined;
  searchQuery: string;
  onResultClick: (
    type: any,
    id: string,
    metadata?: { caseId?: string; teamId?: string; userId?: string },
  ) => void;
  onClose: () => void;
}

export default function SearchDropdown({
  isOpen,
  isLoading,
  results,
  searchQuery,
  onResultClick,
  onClose,
}: SearchDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasResults =
    results &&
    (results.cases.length > 0 ||
      results.clients.length > 0 ||
      results.documents.length > 0 ||
      results.escritos.length > 0 ||
      results.templates.length > 0 ||
      results.libraryDocuments.length > 0);

  return (
    <div
      ref={dropdownRef}
      className={cn(
        "absolute top-full left-0 right-0 mt-2 z-50",
        "bg-popover text-popover-foreground",
        "rounded-md border shadow-lg",
        "max-h-[500px] overflow-y-auto",
        "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2",
      )}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !hasResults ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No se encontraron resultados
        </div>
      ) : (
        <div className="py-2">
          {/* Cases Section */}
          {results.cases.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Casos
              </div>
              <div className="space-y-0.5">
                {results.cases.map((caseItem) => (
                  <SearchResultItem
                    key={caseItem._id}
                    type="case"
                    title={caseItem.title}
                    metadata={{
                      status: caseItem.status,
                      category: caseItem.category,
                    }}
                    onClick={() => onResultClick("case", caseItem._id)}
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Clients Section */}
          {results.clients.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Clientes
              </div>
              <div className="space-y-0.5">
                {results.clients.map((client) => (
                  <SearchResultItem
                    key={client._id}
                    type="client"
                    title={client.displayName}
                    metadata={{
                      naturalezaJuridica: client.naturalezaJuridica,
                      email: client.email,
                    }}
                    onClick={() => onResultClick("client", client._id)}
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Documents Section */}
          {results.documents.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Documentos
              </div>
              <div className="space-y-0.5">
                {results.documents.map((doc) => (
                  <SearchResultItem
                    key={doc._id}
                    type="document"
                    title={doc.title}
                    metadata={{
                      documentType: doc.documentType,
                    }}
                    onClick={() =>
                      onResultClick("document", doc._id, { caseId: doc.caseId })
                    }
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Escritos Section */}
          {results.escritos.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Escritos
              </div>
              <div className="space-y-0.5">
                {results.escritos.map((escrito) => (
                  <SearchResultItem
                    key={escrito._id}
                    type="escrito"
                    title={escrito.title}
                    metadata={{
                      status: escrito.status,
                    }}
                    onClick={() =>
                      onResultClick("escrito", escrito._id, {
                        caseId: escrito.caseId,
                      })
                    }
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Templates Section */}
          {results.templates.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Modelos
              </div>
              <div className="space-y-0.5">
                {results.templates.map((template) => (
                  <SearchResultItem
                    key={template._id}
                    type="template"
                    title={template.name}
                    metadata={{
                      category: template.category,
                      templateType: template.templateType,
                    }}
                    onClick={() => onResultClick("template", template._id)}
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Library Documents Section */}
          {results.libraryDocuments.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Biblioteca
              </div>
              <div className="space-y-0.5">
                {results.libraryDocuments.map((doc) => (
                  <SearchResultItem
                    key={doc._id}
                    type="libraryDocument"
                    title={doc.title}
                    onClick={() =>
                      onResultClick("libraryDocument", doc._id, {
                        teamId: doc.teamId,
                        userId: doc.userId,
                      })
                    }
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
