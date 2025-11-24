import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, MessageCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface ChatHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId?: string;
  currentThreadId?: string;
  onThreadSelect: (threadId: string) => void;
}

export function ChatHistoryDialog({
  open,
  onOpenChange,
  caseId,
  currentThreadId,
  onThreadSelect,
}: ChatHistoryDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);

  const deleteThreadMutation = useMutation(api.agents.threads.deleteThread);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Use search query if provided, otherwise list all threads
  const searchResults = useQuery(
    api.agents.threads.searchThreads,
    debouncedQuery.trim().length > 0
      ? { searchTerm: debouncedQuery, caseId }
      : "skip",
  );

  const allThreads = useQuery(
    api.agents.threads.listThreads,
    debouncedQuery.trim().length === 0
      ? { paginationOpts: { numItems: 50, cursor: null }, caseId }
      : "skip",
  );

  const threads = useMemo(() => {
    if (debouncedQuery.trim().length > 0) {
      return searchResults?.page ?? [];
    }
    return allThreads?.page ?? [];
  }, [debouncedQuery, searchResults, allThreads]);

  const handleThreadClick = (threadId: string) => {
    onThreadSelect(threadId);
    onOpenChange(false);
    setSearchQuery(""); // Clear search on selection
  };

  const formatTimestamp = (timestamp: number) => {
    return formatDistanceToNow(new Date(timestamp), {
      addSuffix: true,
      locale: es,
    });
  };

  const handleDeleteThread = async (threadId: string) => {
    try {
      setDeletingThreadId(threadId);
      await deleteThreadMutation({ threadId });
      toast.success("Conversación eliminada");
      if (currentThreadId === threadId) {
        onThreadSelect(""); // Clear current thread if deleted
      }
    } catch (error) {
      console.error("Error deleting thread", error);
      toast.error("No se pudo eliminar la conversación");
    } finally {
      setDeletingThreadId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[85vw] md:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Historial de Conversaciones
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          {/* Search Input */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={16}
            />
            <Input
              placeholder="Buscar conversaciones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Threads List */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            {threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
                <MessageCircle className="w-12 h-12 mb-3 text-gray-300" />
                <p className="text-sm">
                  {searchQuery.trim().length > 0
                    ? "No se encontraron conversaciones"
                    : "No hay conversaciones previas"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {threads.map((thread: any) => {
                  const isActive = thread._id === currentThreadId;
                  const matchType = thread.matchType;
                  const snippet = thread.searchSnippet;
                  const isDeleting = deletingThreadId === thread._id;

                  return (
                    <div
                      key={thread._id}
                      className="group flex items-start gap-1 w-full"
                    >
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className="flex-1 justify-start h-auto py-3 px-3 text-left hover:bg-gray-50 min-w-0"
                        onClick={() => handleThreadClick(thread._id)}
                        style={{ width: 0 }}
                      >
                        <div className="flex items-start gap-3 w-full">
                          <MessageCircle
                            className={`w-4 h-4 mt-0.5 shrink-0 ${
                              isActive ? "text-blue-600" : "text-gray-400"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p
                                className={`text-sm font-medium truncate ${
                                  isActive ? "text-blue-600" : "text-gray-900"
                                }`}
                              >
                                {thread.title || "Conversación sin título"}
                              </p>
                              {isActive && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full shrink-0">
                                  Actual
                                </span>
                              )}
                            </div>
                            {snippet && matchType === "content" && (
                              <p className="text-xs text-gray-500 line-clamp-2 mb-1">
                                {snippet}
                              </p>
                            )}
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Clock className="w-3 h-3" />
                              <span>
                                {formatTimestamp(thread._creationTime)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 mt-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            disabled={isDeleting}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              ¿Eliminar esta conversación?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción borrará "
                              {thread.title || "Conversación sin título"}" y no
                              se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDeleteThread(thread._id)}
                              disabled={isDeleting}
                            >
                              {isDeleting ? "Eliminando..." : "Eliminar"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
