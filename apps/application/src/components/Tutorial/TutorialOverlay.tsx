import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTutorial } from "@/context/TutorialContext";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tutorial Overlay Component
 *
 * Displays the tutorial overlay with:
 * - Semi-transparent backdrop
 * - Highlighted element (if target specified)
 * - Tutorial card with content and controls
 */
export const TutorialOverlay: React.FC = () => {
  const {
    isActive,
    currentStep,
    currentStepNumber,
    totalSteps,
    progress,
    nextStep,
    previousStep,
    skipPage,
    dismissTutorial,
    canGoNext,
    canGoPrevious,
  } = useTutorial();

  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [cardPosition, setCardPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const targetElementRef = useRef<Element | null>(null);
  const previousZIndexRef = useRef<string>("");
  const previousPositionRef = useRef<string>("");

  // Update highlight and card position when step changes
  useEffect(() => {
    // Limpiar z-index del elemento anterior
    if (targetElementRef.current) {
      const prevElement = targetElementRef.current as HTMLElement;
      if (previousZIndexRef.current !== undefined) {
        prevElement.style.zIndex = previousZIndexRef.current;
      }
      if (previousPositionRef.current !== undefined) {
        prevElement.style.position = previousPositionRef.current;
      }
    }

    if (!isActive || !currentStep) {
      setHighlightRect(null);
      setCardPosition(null);
      targetElementRef.current = null;
      return;
    }

    // Find target element
    if (currentStep.target) {
      const element = document.querySelector(currentStep.target);
      if (element) {
        targetElementRef.current = element;
        const htmlElement = element as HTMLElement;

        // Si allowClickThrough está activo, aumentar el z-index
        if (currentStep.allowClickThrough) {
          previousZIndexRef.current = htmlElement.style.zIndex;
          previousPositionRef.current = htmlElement.style.position;
          htmlElement.style.position = "relative";
          htmlElement.style.zIndex = "10001";
        }

        const rect = element.getBoundingClientRect();
        setHighlightRect(rect);

        // Calculate card position based on placement
        const cardPos = calculateCardPosition(
          rect,
          currentStep.placement || "bottom",
        );
        setCardPosition(cardPos);

        // Scroll element into view if needed
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        targetElementRef.current = null;
        setHighlightRect(null);
        // Center card if no target
        setCardPosition({
          top: window.innerHeight / 2,
          left: window.innerWidth / 2,
        });
      }
    } else {
      targetElementRef.current = null;
      setHighlightRect(null);
      // Center card for non-targeted steps
      setCardPosition({
        top: window.innerHeight / 2,
        left: window.innerWidth / 2,
      });
    }
  }, [isActive, currentStep]);

  // Auto-advance on user interaction
  useEffect(() => {
    if (!isActive || !currentStep || !currentStep.autoAdvanceOn) {
      return;
    }

    const { event, selector, customEvent } = currentStep.autoAdvanceOn;

    if (event === "click" && selector) {
      const handleClick = () => {
        // Pequeño delay para que se complete la acción antes de avanzar
        setTimeout(() => {
          nextStep();
        }, 300);
      };

      const element = document.querySelector(selector);
      if (element) {
        element.addEventListener("click", handleClick);
        return () => element.removeEventListener("click", handleClick);
      }
    } else if (event === "custom" && customEvent) {
      const handleCustomEvent = () => {
        setTimeout(() => {
          nextStep();
        }, 300);
      };

      window.addEventListener(customEvent, handleCustomEvent);
      return () => window.removeEventListener(customEvent, handleCustomEvent);
    }
  }, [isActive, currentStep, nextStep]);

  // Update positions on window resize
  useEffect(() => {
    if (!isActive) return;

    const handleResize = () => {
      if (targetElementRef.current && currentStep?.target) {
        const rect = targetElementRef.current.getBoundingClientRect();
        setHighlightRect(rect);
        const cardPos = calculateCardPosition(
          rect,
          currentStep.placement || "bottom",
        );
        setCardPosition(cardPos);
      } else if (!currentStep?.target) {
        setCardPosition({
          top: window.innerHeight / 2,
          left: window.innerWidth / 2,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isActive, currentStep]);

  if (!isActive || !currentStep) {
    return null;
  }

  return createPortal(
    <div className="tutorial-overlay fixed inset-0 z-[9999]">
      {/* Backdrop with cutout for highlighted element */}
      <TutorialBackdrop
        highlightRect={highlightRect}
        padding={currentStep.highlightPadding || 8}
        allowClickThrough={currentStep.allowClickThrough}
      />

      {/* Tutorial Card */}
      <TutorialCard
        step={currentStep}
        position={cardPosition}
        stepNumber={currentStepNumber}
        totalSteps={totalSteps}
        progress={progress}
        onNext={nextStep}
        onPrevious={previousStep}
        onSkip={skipPage}
        onDismiss={dismissTutorial}
        canGoNext={canGoNext}
        canGoPrevious={canGoPrevious}
      />
    </div>,
    document.body,
  );
};

/**
 * Calculate card position based on highlighted element and placement
 */
function calculateCardPosition(
  targetRect: DOMRect,
  placement: string,
): { top: number; left: number } {
  const cardWidth = 400; // Approximate card width
  const cardHeight = 300; // Approximate card height
  const gap = 20; // Gap between highlight and card

  switch (placement) {
    case "top":
      return {
        top: targetRect.top - cardHeight - gap,
        left: targetRect.left + targetRect.width / 2 - cardWidth / 2,
      };
    case "bottom":
      return {
        top: targetRect.bottom + gap,
        left: targetRect.left + targetRect.width / 2 - cardWidth / 2,
      };
    case "left":
      return {
        top: targetRect.top + targetRect.height / 2 - cardHeight / 2,
        left: targetRect.left - cardWidth - gap,
      };
    case "right":
      return {
        top: targetRect.top + targetRect.height / 2 - cardHeight / 2,
        left: targetRect.right + gap,
      };
    case "top-left":
      return {
        top: targetRect.top - cardHeight - gap,
        left: targetRect.left,
      };
    case "top-right":
      return {
        top: targetRect.top - cardHeight - gap,
        left: targetRect.right - cardWidth,
      };
    case "bottom-left":
      return {
        top: targetRect.bottom + gap,
        left: targetRect.left,
      };
    case "bottom-right":
      return {
        top: targetRect.bottom + gap,
        left: targetRect.right - cardWidth,
      };
    case "center":
    default:
      return {
        top: window.innerHeight / 2 - cardHeight / 2,
        left: window.innerWidth / 2 - cardWidth / 2,
      };
  }
}

/**
 * Tutorial Backdrop with SVG cutout for highlighted element
 */
interface TutorialBackdropProps {
  highlightRect: DOMRect | null;
  padding: number;
  allowClickThrough?: boolean;
}

const TutorialBackdrop: React.FC<TutorialBackdropProps> = ({
  highlightRect,
  padding,
  allowClickThrough,
}) => {
  if (!highlightRect) {
    // Simple overlay without cutout
    return <div className="absolute inset-0 bg-black/50" />;
  }

  const x = highlightRect.left - padding;
  const y = highlightRect.top - padding;
  const width = highlightRect.width + padding * 2;
  const height = highlightRect.height + padding * 2;
  const radius = 8; // Border radius for the cutout

  return (
    <>
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: allowClickThrough ? "none" : "auto" }}
      >
        <defs>
          <mask id="tutorial-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              rx={radius}
              ry={radius}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.5)"
          mask="url(#tutorial-mask)"
        />
      </svg>
      {/* Highlight border - always non-interactive */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: "none" }}
      >
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={radius}
          ry={radius}
          fill="none"
          stroke="#4F46E5"
          strokeWidth="2"
          className="animate-pulse"
        />
      </svg>
    </>
  );
};

/**
 * Tutorial Card Component
 */
interface TutorialCardProps {
  step: any;
  position: { top: number; left: number } | null;
  stepNumber: number;
  totalSteps: number;
  progress: number;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onDismiss: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

const TutorialCard: React.FC<TutorialCardProps> = ({
  step,
  position,
  stepNumber,
  totalSteps,
  progress,
  onNext,
  onPrevious,
  onSkip,
  onDismiss,
  canGoNext,
  canGoPrevious,
}) => {
  if (!position) return null;

  // Ensure card stays within viewport
  const adjustedPosition = {
    top: Math.max(20, Math.min(position.top, window.innerHeight - 350)),
    left: Math.max(20, Math.min(position.left, window.innerWidth - 420)),
  };

  return (
    <div
      className="absolute bg-white rounded-lg shadow-2xl border border-gray-200 w-[400px] max-w-[calc(100vw-40px)] z-[10000] animate-in fade-in-50 slide-in-from-bottom-5 duration-300"
      style={{
        top: `${adjustedPosition.top}px`,
        left: `${adjustedPosition.left}px`,
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Cerrar tutorial"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>
            Paso {stepNumber} de {totalSteps}
          </span>
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4F46E5] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-sm text-gray-700 leading-relaxed">{step.content}</p>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSkip}
          className="text-gray-500 hover:text-gray-700"
        >
          <SkipForward className="w-4 h-4 mr-1" />
          Saltar página
        </Button>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrevious}
            disabled={!canGoPrevious}
            className={cn(!canGoPrevious && "opacity-50 cursor-not-allowed")}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Anterior
          </Button>

          <Button
            size="sm"
            onClick={onNext}
            disabled={!!step.autoAdvanceOn}
            className={cn(
              "bg-[#4F46E5] hover:bg-[#4338CA] text-white",
              step.autoAdvanceOn && "opacity-50 cursor-not-allowed",
            )}
          >
            {canGoNext ? "Siguiente" : "Finalizar"}
            {canGoNext && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
};
