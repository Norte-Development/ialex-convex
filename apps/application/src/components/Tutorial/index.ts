/**
 * Tutorial System - Exports
 *
 * Sistema completo de tutorial interactivo para iAlex
 */

// Main components
export { TutorialOverlay } from "./TutorialOverlay";
export {
  TutorialTrigger,
  TutorialProgress,
  TutorialWelcomeDialog,
} from "./TutorialControls";
export {
  TutorialManager,
  SidebarTutorialButton,
  HeaderTutorialBadge,
} from "./TutorialManager";

// Re-export context hook for convenience
export { useTutorial } from "@/context/TutorialContext";

// Re-export config utilities
export {
  getPageSteps,
  getStepById,
  getPageForStep,
  getNextStep,
  getPreviousStep,
  getTotalSteps,
  getStepNumber,
  getAllPages,
  hasPageTutorial,
  type TutorialStep,
  type TutorialPage,
} from "@/config/tutorialConfig";
