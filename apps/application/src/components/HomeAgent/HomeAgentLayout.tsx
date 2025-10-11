/**
 * HomeAgentLayout Component
 *
 * Layout compartido para todas las páginas del HomeAgent
 * Incluye la sidebar de threads
 */

import { ReactNode } from "react";
import { HomeAgentSidebar } from "./HomeAgentSidebar";
import { useLayout } from "@/context/LayoutContext";

interface HomeAgentLayoutProps {
  children: ReactNode;
  currentThreadId?: string;
}

export function HomeAgentLayout({
  children,
  currentThreadId,
}: HomeAgentLayoutProps) {
  const { isHomeAgentSidebarOpen } = useLayout();

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar de threads */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isHomeAgentSidebarOpen ? "w-64" : "w-0"
        }`}
      >
        <HomeAgentSidebar currentThreadId={currentThreadId} />
      </div>

      {/* Contenido principal */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
