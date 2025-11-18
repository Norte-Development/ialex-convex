/**
 * HomeAgentSidebar Component
 *
 * Sidebar expandible para navegar entre threads del HomeAgent
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHomeThreads } from "./hooks/useHomeThreads";
import { useLayout } from "@/context/LayoutContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageCircle,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface HomeAgentSidebarProps {
  currentThreadId?: string;
}

export function HomeAgentSidebar({ currentThreadId }: HomeAgentSidebarProps) {
  const navigate = useNavigate();
  const { threads, isLoading, deleteThread } = useHomeThreads();
  const { isHomeAgentSidebarOpen, toggleHomeAgentSidebar } = useLayout();
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);

  const handleThreadSelect = (threadId: string) => {
    navigate(`/ai/${threadId}`);
  };

  const handleNewThread = () => {
    // Just navigate to /ai to clear thread - new thread will be created on first message
    navigate("/ai");
  };

  const handleGoHome = () => {
    navigate("/ai");
  };

  const handleDeleteThread = async (threadId: string) => {
    try {
      setDeletingThreadId(threadId);
      await deleteThread(threadId);
      toast.success("Conversación eliminada");
      if (currentThreadId === threadId) {
        navigate("/ai");
      }
    } catch (error) {
      console.error("Error deleting thread", error);
      toast.error("No se pudo eliminar la conversación");
    } finally {
      setDeletingThreadId((current) => (current === threadId ? null : current));
    }
  };

  // Filtrar threads por búsqueda
  const filteredThreads = threads.filter((thread) =>
    thread.title?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <>
      {/* Sidebar */}
      <div
        className={`relative z-30 h-screen border-r border-border flex flex-col text-sm transition-all duration-300 ease-in-out overflow-hidden bg-background ${
          isHomeAgentSidebarOpen ? "w-64" : "w-0"
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex pt-20 items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            <span className="font-semibold">Conversaciones</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleHomeAgentSidebar}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Nueva conversación */}
        <div className="p-3 border-b border-border">
          <Button
            onClick={handleNewThread}
            className="w-full justify-start gap-2"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            Nueva conversación
          </Button>
        </div>

        {/* Búsqueda */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversaciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Lista de threads */}
        <div
          className="flex-1 overflow-y-scroll [&::-webkit-scrollbar]:hidden"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Cargando...
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {searchTerm
                ? "No se encontraron conversaciones"
                : "No hay conversaciones"}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredThreads.map((thread) => {
                const isActive = currentThreadId === thread._id;
                const isDeleting = deletingThreadId === thread._id;

                return (
                  <div
                    key={thread._id}
                    className={`group flex items-center gap-1 rounded-md transition-colors ${
                      isActive
                        ? "bg-accent border-l-2 border-primary"
                        : "hover:bg-accent"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleThreadSelect(thread._id)}
                      className="flex-1 text-left p-3 min-w-0"
                      style={{ width: 0 }}
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium truncate">
                          {thread.title || "Sin título"}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {new Date(thread._creationTime).toLocaleDateString(
                            "es-AR",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </span>
                      </div>
                    </button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 mr-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Eliminar conversación"
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
                            Esta acción borrará "{thread.title || "Sin título"}"
                            y no se puede deshacer.
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
        </div>

        {/* Footer - Ver todas */}
        <div className="p-3 border-t border-border">
          <Button
            onClick={handleGoHome}
            variant="ghost"
            className="w-full justify-start text-xs text-muted-foreground"
          >
            Ver todas las conversaciones ({threads.length})
          </Button>
        </div>
      </div>

      {/* Botón para abrir sidebar cuando está cerrada */}
      {!isHomeAgentSidebarOpen && (
        <button
          onClick={toggleHomeAgentSidebar}
          className="fixed top-1/2 left-2 z-40 cursor-pointer bg-white border border-gray-300 rounded-full p-2 shadow-md hover:shadow-lg transition-shadow"
          aria-label="Abrir sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </>
  );
}
