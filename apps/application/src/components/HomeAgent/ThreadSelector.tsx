/**
 * ThreadSelector Component
 *
 * Dropdown selector para navegar entre threads del HomeAgent
 */

import { useNavigate } from "react-router-dom";
import { useHomeThreads } from "./hooks/useHomeThreads";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MessageCircle, ChevronDown, Plus } from "lucide-react";

interface ThreadSelectorProps {
  currentThreadId?: string;
}

export function ThreadSelector({ currentThreadId }: ThreadSelectorProps) {
  const navigate = useNavigate();
  const { threads, isLoading, createThread } = useHomeThreads();

  console.log(threads);

  const currentThread = threads.find((t) => t._id === currentThreadId);

  const handleThreadSelect = (threadId: string) => {
    navigate(`/ai/${threadId}`);
  };

  const handleNewThread = async () => {
    try {
      const threadId = await createThread("Nueva conversación");
      if (threadId) {
        navigate(`/ai/${threadId}`);
      }
    } catch (error) {
      console.error("Error creating thread:", error);
    }
  };

  const handleGoHome = () => {
    navigate("/ai");
  };

  if (isLoading) {
    return (
      <Button variant="outline" disabled>
        <MessageCircle className="h-4 w-4 mr-2" />
        Cargando...
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="max-w-[200px] truncate">
            {currentThread?.title || "Historial"}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[300px]">
        <DropdownMenuLabel>Historial</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Nueva conversación */}
        <DropdownMenuItem onClick={handleNewThread}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva conversación
        </DropdownMenuItem>

        {/* Ir a Home */}
        <DropdownMenuItem onClick={handleGoHome}>
          <MessageCircle className="h-4 w-4 mr-2" />
          Ver todas
        </DropdownMenuItem>

        {threads.length > 0 && <DropdownMenuSeparator />}

        {/* Lista de threads */}
        {threads.slice(0, 10).map((thread) => (
          <DropdownMenuItem
            key={thread._id}
            onClick={() => handleThreadSelect(thread._id)}
            className={currentThreadId === thread._id ? "bg-accent" : ""}
          >
            <div className="flex flex-col gap-1 w-full">
              <span className="text-sm font-medium truncate">
                {thread.title || "Sin título"}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(thread._creationTime).toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
          </DropdownMenuItem>
        ))}

        {threads.length > 10 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleGoHome}>
              <span className="text-xs text-muted-foreground">
                Ver todas las conversaciones ({threads.length})
              </span>
            </DropdownMenuItem>
          </>
        )}

        {threads.length === 0 && (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            No hay conversaciones
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
