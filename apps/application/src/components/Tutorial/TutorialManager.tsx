import React, { useState, useEffect } from "react";
import { useTutorial } from "@/context/TutorialContext";
import {
  TutorialTrigger,
  TutorialProgress,
  TutorialWelcomeDialog,
} from "./TutorialControls";
import { useAuth } from "@/context/AuthContext";

/**
 * Tutorial Manager Component
 *
 * Este componente maneja la lógica de mostrar el tutorial automáticamente
 * a nuevos usuarios después del onboarding.
 *
 * Úsalo en tu Layout principal o en HomePage.
 */
export const TutorialManager: React.FC = () => {
  const { user } = useAuth();
  const { startTutorial, isActive, isCompleted } = useTutorial();
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);

  useEffect(() => {
    // Solo para usuarios que completaron onboarding
    if (!user || !user.isOnboardingComplete) return;

    // Verificar si el usuario ya vio el tutorial
    const tutorialKey = `tutorial-seen-${user._id}`;
    const hasSeenTutorial = localStorage.getItem(tutorialKey);

    // Si no ha visto el tutorial y no está activo/completado, mostrar dialog
    if (!hasSeenTutorial && !isActive && !isCompleted) {
      // Esperar un poco antes de mostrar el dialog (mejor UX)
      const timer = setTimeout(() => {
        setShowWelcomeDialog(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [user, isActive, isCompleted]);

  const handleStartTutorial = () => {
    if (user) {
      const tutorialKey = `tutorial-seen-${user._id}`;
      localStorage.setItem(tutorialKey, "true");
      setShowWelcomeDialog(false);
      startTutorial("home");
    }
  };

  const handleSkipTutorial = () => {
    if (user) {
      const tutorialKey = `tutorial-seen-${user._id}`;
      localStorage.setItem(tutorialKey, "true");
      setShowWelcomeDialog(false);
    }
  };

  return (
    <TutorialWelcomeDialog
      open={showWelcomeDialog}
      onStart={handleStartTutorial}
      onClose={handleSkipTutorial}
    />
  );
};

/**
 * Tutorial Button para Sidebar
 *
 * Muestra el botón de tutorial con el progreso si está activo
 */
export const SidebarTutorialButton: React.FC = () => {
  const { isActive } = useTutorial();

  return (
    <div className="px-3 py-2">
      {isActive && (
        <div className="mb-3">
          <TutorialProgress />
        </div>
      )}
      <TutorialTrigger variant="outline" className="w-full justify-start" />
    </div>
  );
};

/**
 * Tutorial Badge para Header
 *
 * Muestra un pequeño badge en el header cuando el tutorial está activo
 */
export const HeaderTutorialBadge: React.FC = () => {
  const { isActive, currentStepNumber, totalSteps } = useTutorial();

  if (!isActive) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
      <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
      Tutorial: {currentStepNumber}/{totalSteps}
    </div>
  );
};

/**
 * Ejemplo de uso en una página
 */
export const ExamplePageWithTutorial: React.FC = () => {
  return (
    <div className="p-6">
      <h1>Mi Página</h1>

      {/* Elementos marcados para el tutorial */}
      <button data-tutorial="example-button" className="btn btn-primary">
        Acción Importante
      </button>

      <div data-tutorial="example-section" className="mt-4">
        <h2>Sección Importante</h2>
        <p>Contenido que quieres explicar en el tutorial...</p>
      </div>

      {/* Sidebar con tutorial */}
      <aside data-tutorial="example-sidebar">
        <SidebarTutorialButton />
      </aside>
    </div>
  );
};
