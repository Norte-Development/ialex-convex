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
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HomeAgentSidebarProps {
  currentThreadId?: string;
}

export function HomeAgentSidebar({ currentThreadId }: HomeAgentSidebarProps) {
  const navigate = useNavigate();
  const { threads, isLoading } = useHomeThreads();
  const { isHomeAgentSidebarOpen, toggleHomeAgentSidebar } = useLayout();
  const [searchTerm, setSearchTerm] = useState("");

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
        <ScrollArea className="flex-1">
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
            <div className="p-2">
              {filteredThreads.map((thread) => (
                <button
                  key={thread._id}
                  onClick={() => handleThreadSelect(thread._id)}
                  className={`w-full text-left p-3 rounded-md hover:bg-accent transition-colors mb-1 ${
                    currentThreadId === thread._id
                      ? "bg-accent border-l-2 border-primary"
                      : ""
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium truncate">
                      {thread.title || "Sin título"}
                    </span>
                    <span className="text-xs text-muted-foreground">
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
              ))}
            </div>
          )}
        </ScrollArea>

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
