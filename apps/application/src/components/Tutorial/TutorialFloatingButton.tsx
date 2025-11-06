import React from "react";
import { useTutorial } from "@/context/TutorialContext";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { useLocation } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Tutorial Floating Button
 *
 * Un botón flotante con el símbolo "?" que muestra la ayuda/tutorial de la página actual.
 * Siempre inicia el tutorial de la página donde estás, sin importar si ya lo viste antes.
 */

interface TutorialFloatingButtonProps {
  /** Posición del botón. Por defecto: 'bottom-right' */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Margen desde el borde. Por defecto: '24px' */
  margin?: string;
  /** Forzar una página específica en lugar de detectarla automáticamente */
  forcePage?: string;
}

export const TutorialFloatingButton: React.FC<TutorialFloatingButtonProps> = ({
  position = "bottom-right",
  margin = "24px",
  forcePage,
}) => {
  const { startTutorial } = useTutorial();
  const location = useLocation();

  // Mapea las rutas a las páginas del tutorial
  const getPageFromPath = (): string => {
    const path = location.pathname;

    if (path === "/" || path === "/home") return "home";
    if (path.startsWith("/ai")) return "chat";
    if (path.startsWith("/cases")) return "cases";
    if (path.startsWith("/documents")) return "documents";
    if (path.startsWith("/settings")) return "settings";

    // Default to home si no se encuentra una página específica
    return "home";
  };

  const handleClick = () => {
    const page = forcePage || getPageFromPath();
    // Siempre inicia el tutorial de la página actual
    startTutorial(page);
  };

  // Estilos de posición
  const positionStyles: Record<string, React.CSSProperties> = {
    "bottom-right": {
      bottom: margin,
      right: margin,
    },
    "bottom-left": {
      bottom: margin,
      left: margin,
    },
    "top-right": {
      top: margin,
      right: margin,
    },
    "top-left": {
      top: margin,
      left: margin,
    },
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleClick}
            size="icon"
            className="fixed z-40 h-12 w-12 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 hover:scale-110"
            style={positionStyles[position]}
            aria-label="Ayuda"
          >
            <HelpCircle className="h-6 w-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="bg-gray-900 text-white">
          <p>Ayuda</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/**
 * Tutorial Floating Button (Variant Pequeño)
 *
 * Una versión más pequeña del botón flotante para usar en espacios reducidos
 */
export const TutorialFloatingButtonSmall: React.FC<
  TutorialFloatingButtonProps
> = ({ position = "bottom-right", margin = "16px", forcePage }) => {
  const { startTutorial } = useTutorial();
  const location = useLocation();

  const getPageFromPath = (): string => {
    const path = location.pathname;

    if (path === "/" || path === "/home") return "home";
    if (path.startsWith("/ai")) return "chat";
    if (path.startsWith("/cases")) return "cases";
    if (path.startsWith("/documents")) return "documents";
    if (path.startsWith("/settings")) return "settings";

    return "home";
  };

  const handleClick = () => {
    const page = forcePage || getPageFromPath();
    // Siempre inicia el tutorial de la página actual
    startTutorial(page);
  };

  const positionStyles: Record<string, React.CSSProperties> = {
    "bottom-right": {
      bottom: margin,
      right: margin,
    },
    "bottom-left": {
      bottom: margin,
      left: margin,
    },
    "top-right": {
      top: margin,
      right: margin,
    },
    "top-left": {
      top: margin,
      left: margin,
    },
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleClick}
            size="icon"
            className="fixed z-40 h-10 w-10 rounded-full shadow-md bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 hover:scale-105"
            style={positionStyles[position]}
            aria-label="Ayuda"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="bg-gray-900 text-white">
          <p>Ayuda</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
