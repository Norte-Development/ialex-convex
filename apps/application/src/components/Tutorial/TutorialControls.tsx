import React from "react";
import { useTutorial } from "@/context/TutorialContext";
import { Button } from "@/components/ui/button";
import { BookOpen, Play, RotateCcw } from "lucide-react";

/**
 * Tutorial Trigger Button
 *
 * A button to start or restart the tutorial.
 * Can be placed anywhere in the app (e.g., in settings, help menu, etc.)
 */
interface TutorialTriggerProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  startPage?: string;
}

export const TutorialTrigger: React.FC<TutorialTriggerProps> = ({
  variant = "outline",
  size = "default",
  className,
  startPage,
}) => {
  const { isActive, isCompleted, startTutorial, reactivateTutorial } =
    useTutorial();

  const handleClick = () => {
    if (isCompleted || !isActive) {
      startTutorial(startPage);
    } else {
      reactivateTutorial();
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={className}
    >
      {isCompleted ? (
        <>
          <RotateCcw className="w-4 h-4 mr-2" />
          Reiniciar Tutorial
        </>
      ) : isActive ? (
        <>
          <Play className="w-4 h-4 mr-2" />
          Continuar Tutorial
        </>
      ) : (
        <>
          <BookOpen className="w-4 h-4 mr-2" />
          Iniciar Tutorial
        </>
      )}
    </Button>
  );
};

/**
 * Tutorial Progress Indicator
 *
 * Shows the current progress of the tutorial.
 * Can be displayed in a sidebar or header.
 */
export const TutorialProgress: React.FC = () => {
  const { isActive, progress, currentStepNumber, totalSteps } = useTutorial();

  if (!isActive) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium text-blue-900">
          Tutorial: {currentStepNumber}/{totalSteps}
        </span>
        <span className="text-blue-400">•</span>
        <span className="font-semibold text-blue-600">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
};

/**
 * Tutorial Welcome Dialog
 *
 * An optional welcome dialog that can be shown to new users
 * to prompt them to start the tutorial.
 */
interface TutorialWelcomeDialogProps {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
}

export const TutorialWelcomeDialog: React.FC<TutorialWelcomeDialogProps> = ({
  open,
  onClose,
  onStart,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 animate-in fade-in-50 zoom-in-95 duration-300">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              ¡Bienvenido a iAlex!
            </h2>
            <p className="text-sm text-gray-500">
              Tu asistente legal inteligente
            </p>
          </div>
        </div>

        <p className="text-gray-700 mb-6">
          ¿Te gustaría realizar un recorrido rápido por la plataforma? Te
          mostraremos las funciones principales y cómo sacar el máximo provecho
          de iAlex.
        </p>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Explorar por mi cuenta
          </Button>
          <Button
            onClick={onStart}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Play className="w-4 h-4 mr-2" />
            Comenzar Tutorial
          </Button>
        </div>
      </div>
    </div>
  );
};
