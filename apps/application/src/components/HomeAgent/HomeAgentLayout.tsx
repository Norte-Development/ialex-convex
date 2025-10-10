/**
 * HomeAgentLayout Component
 *
 * Layout compartido para todas las páginas del HomeAgent
 * Incluye el selector de threads en el header
 */

import { ReactNode } from "react";
import { ThreadSelector } from "./ThreadSelector";

interface HomeAgentLayoutProps {
  children: ReactNode;
  currentThreadId?: string;
}

export function HomeAgentLayout({
  children,
  currentThreadId,
}: HomeAgentLayoutProps) {
  return (
    <div className="flex flex-col h-screen w-full relative ">
      {/* Header con selector de threads */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-4 py-3 absolute top-15 left-0 right-0 z-10 ">
          <ThreadSelector currentThreadId={currentThreadId} />
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
