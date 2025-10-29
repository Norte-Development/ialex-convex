import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useLocation, useNavigate } from "react-router-dom";
import {
  tutorialConfig,
  getPageSteps,
  getNextStep,
  getPreviousStep,
  getStepNumber,
  getTotalSteps,
  hasPageTutorial,
  type TutorialStep,
} from "@/config/tutorialConfig";
import { useAuth } from "./AuthContext";

interface TutorialContextType {
  // State
  isActive: boolean;
  isCompleted: boolean;
  currentStep: TutorialStep | null;
  currentPage: string | null;
  completedSteps: string[];

  // Progress info
  currentStepNumber: number;
  totalSteps: number;
  progress: number; // percentage

  // Actions
  startTutorial: (startPage?: string) => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (stepId: string) => void;
  skipPage: () => void;
  completeTutorial: () => void;
  dismissTutorial: () => void;
  reactivateTutorial: () => void;

  // Helpers
  isStepCompleted: (stepId: string) => boolean;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

const TutorialContext = createContext<TutorialContextType | undefined>(
  undefined,
);

interface TutorialProviderProps {
  children: ReactNode;
}

export const TutorialProvider: React.FC<TutorialProviderProps> = ({
  children,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Convex queries and mutations
  const tutorialProgress = useQuery(api.functions.tutorial.getTutorialProgress);
  const initializeTutorialMutation = useMutation(
    api.functions.tutorial.initializeTutorial,
  );
  const updateCurrentStepMutation = useMutation(
    api.functions.tutorial.updateCurrentStep,
  );
  const completeStepMutation = useMutation(api.functions.tutorial.completeStep);
  const skipPageMutation = useMutation(api.functions.tutorial.skipPage);
  const completeTutorialMutation = useMutation(
    api.functions.tutorial.completeTutorial,
  );
  const dismissTutorialMutation = useMutation(
    api.functions.tutorial.dismissTutorial,
  );
  const reactivateTutorialMutation = useMutation(
    api.functions.tutorial.reactivateTutorial,
  );

  // Local state for current step
  const [currentStep, setCurrentStep] = useState<TutorialStep | null>(null);
  const [currentPage, setCurrentPage] = useState<string | null>(null);

  // Derive current page from location
  useEffect(() => {
    const pathSegments = location.pathname.split("/").filter(Boolean);
    let pageName = "home";

    if (pathSegments.length > 0) {
      const firstSegment = pathSegments[0];

      // Map URL to page names used in tutorial config
      switch (firstSegment) {
        case "casos":
          // Match dynamic routes like "casos/:id" -> "casos/:id"
          pageName = pathSegments.length > 1 ? "casos/:id" : "casos";
          break;
        case "clients":
          pageName = "clients";
          break;
        case "library":
          pageName = "library";
          break;
        case "data-base":
          pageName = "database";
          break;
        default:
          pageName = firstSegment;
      }
    }

    setCurrentPage(pageName);
  }, [location.pathname]);

  // Update current step when page or tutorial progress changes
  useEffect(() => {
    if (!tutorialProgress || !tutorialProgress.isActive || !currentPage) {
      setCurrentStep(null);
      return;
    }

    // If we have a saved current step ID, use that
    if (tutorialProgress.currentStepId) {
      const step = getStepById(tutorialProgress.currentStepId);
      if (step) {
        setCurrentStep(step);
        return;
      }
    }

    // Otherwise, get the first step of the current page
    const pageSteps = getPageSteps(currentPage);
    if (pageSteps && pageSteps.length > 0) {
      // Find the first uncompleted step
      const uncompletedStep = pageSteps.find(
        (step) => !tutorialProgress.completedSteps.includes(step.id),
      );

      if (uncompletedStep) {
        setCurrentStep(uncompletedStep);
        updateCurrentStepMutation({
          stepId: uncompletedStep.id,
          page: currentPage,
        }).catch(console.error);
      } else {
        // All steps on this page are completed
        setCurrentStep(null);
      }
    } else {
      setCurrentStep(null);
    }
  }, [tutorialProgress, currentPage]);

  // Helper to get step by ID (search all pages)
  const getStepById = (stepId: string): TutorialStep | undefined => {
    for (const page of tutorialConfig) {
      const step = page.steps.find((s) => s.id === stepId);
      if (step) return step;
    }
    return undefined;
  };

  // Calculate progress percentage
  const totalSteps = getTotalSteps();
  const completedCount = tutorialProgress?.completedSteps.length || 0;
  const progress = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;

  const currentStepNumber = currentStep
    ? getStepNumber(currentStep.id) || 0
    : 0;

  // Start tutorial
  const startTutorial = useCallback(
    async (startPage?: string) => {
      if (!user) return;

      try {
        await initializeTutorialMutation({ startOnPage: startPage });
      } catch (error) {
        console.error("Failed to start tutorial:", error);
      }
    },
    [user, initializeTutorialMutation],
  );

  // Next step
  const nextStep = useCallback(async () => {
    if (!currentStep) return;

    try {
      // Mark current step as completed
      await completeStepMutation({ stepId: currentStep.id });

      // Get next step
      const next = getNextStep(currentStep.id);

      if (next) {
        // Check if we need to navigate to a different page
        if (next.page.page !== currentPage) {
          // Navigate to the next page
          const pageRoute = getRouteForPage(next.page.page);
          if (pageRoute) {
            navigate(pageRoute);
          }
        }

        // Update current step
        await updateCurrentStepMutation({
          stepId: next.step.id,
          page: next.page.page,
        });

        // Handle any step action
        if (next.step.action) {
          handleStepAction(next.step.action);
        }
      } else {
        // No more steps - complete tutorial
        await completeTutorialMutation();
      }
    } catch (error) {
      console.error("Failed to go to next step:", error);
    }
  }, [
    currentStep,
    currentPage,
    completeStepMutation,
    updateCurrentStepMutation,
    completeTutorialMutation,
    navigate,
  ]);

  // Previous step
  const previousStep = useCallback(async () => {
    if (!currentStep) return;

    try {
      const prev = getPreviousStep(currentStep.id);

      if (prev) {
        // Check if we need to navigate to a different page
        if (prev.page.page !== currentPage) {
          const pageRoute = getRouteForPage(prev.page.page);
          if (pageRoute) {
            navigate(pageRoute);
          }
        }

        // Update current step
        await updateCurrentStepMutation({
          stepId: prev.step.id,
          page: prev.page.page,
        });
      }
    } catch (error) {
      console.error("Failed to go to previous step:", error);
    }
  }, [currentStep, currentPage, updateCurrentStepMutation, navigate]);

  // Go to specific step
  const goToStep = useCallback(
    async (stepId: string) => {
      try {
        const step = getStepById(stepId);
        if (!step) return;

        // Find which page contains this step
        const page = tutorialConfig.find((p) =>
          p.steps.some((s) => s.id === stepId),
        );

        if (!page) return;

        // Navigate to the page if needed
        if (page.page !== currentPage) {
          const pageRoute = getRouteForPage(page.page);
          if (pageRoute) {
            navigate(pageRoute);
          }
        }

        // Update current step
        await updateCurrentStepMutation({
          stepId: stepId,
          page: page.page,
        });
      } catch (error) {
        console.error("Failed to go to step:", error);
      }
    },
    [currentPage, updateCurrentStepMutation, navigate],
  );

  // Skip current page
  const skipPage = useCallback(async () => {
    if (!currentPage) return;

    try {
      await skipPageMutation({ page: currentPage });

      // Find next page with tutorial
      const currentPageIndex = tutorialConfig.findIndex(
        (p) => p.page === currentPage,
      );
      if (currentPageIndex < tutorialConfig.length - 1) {
        const nextPage = tutorialConfig[currentPageIndex + 1];
        const pageRoute = getRouteForPage(nextPage.page);
        if (pageRoute) {
          navigate(pageRoute);
        }
      } else {
        // No more pages - complete tutorial
        await completeTutorialMutation();
      }
    } catch (error) {
      console.error("Failed to skip page:", error);
    }
  }, [currentPage, skipPageMutation, completeTutorialMutation, navigate]);

  // Complete tutorial
  const completeTutorial = useCallback(async () => {
    try {
      await completeTutorialMutation();
    } catch (error) {
      console.error("Failed to complete tutorial:", error);
    }
  }, [completeTutorialMutation]);

  // Dismiss tutorial
  const dismissTutorial = useCallback(async () => {
    try {
      await dismissTutorialMutation();
    } catch (error) {
      console.error("Failed to dismiss tutorial:", error);
    }
  }, [dismissTutorialMutation]);

  // Reactivate tutorial
  const reactivateTutorial = useCallback(async () => {
    try {
      await reactivateTutorialMutation();
    } catch (error) {
      console.error("Failed to reactivate tutorial:", error);
    }
  }, [reactivateTutorialMutation]);

  // Check if a step is completed
  const isStepCompleted = useCallback(
    (stepId: string): boolean => {
      return tutorialProgress?.completedSteps.includes(stepId) || false;
    },
    [tutorialProgress],
  );

  // Handle step actions
  const handleStepAction = (action: TutorialStep["action"]) => {
    if (!action) return;

    switch (action.type) {
      case "navigate":
        if (action.value) {
          let targetPath: string;

          if (action.value.startsWith("/")) {
            // 1. Absolute path: use as is
            // Example: "/casos" -> "/casos"
            targetPath = action.value;
          } else if (action.value.startsWith("./")) {
            // 2. Relative append: add to current path
            // Example: from "/casos/abc123" + "./documentos" -> "/casos/abc123/documentos"
            const relativePath = action.value.substring(2); // Remove "./"
            targetPath = `${location.pathname}/${relativePath}`;
          } else {
            // 3. Relative replace: replace last segment
            // Example: from "/casos/abc123/documentos" + "escritos" -> "/casos/abc123/escritos"
            const pathSegments = location.pathname.split("/").filter(Boolean);

            // Remove the last segment and add the new one
            pathSegments.pop();
            pathSegments.push(action.value);

            targetPath = "/" + pathSegments.join("/");
          }

          navigate(targetPath);
        }
        break;
      case "click":
        if (action.value) {
          const element = document.querySelector(action.value);
          if (element instanceof HTMLElement) {
            element.click();
          }
        }
        break;
      case "custom":
        if (action.handler) {
          action.handler();
        }
        break;
    }
  };

  // Map page names to routes
  const getRouteForPage = (page: string): string | null => {
    switch (page) {
      case "home":
        return "/";
      case "cases":
        return "/cases";
      case "case-detail":
        return "/cases"; // Will need a specific case ID in real usage
      case "clients":
        return "/clients";
      case "library":
        return "/library";
      case "database":
        return "/data-base";
      default:
        return null;
    }
  };

  const canGoNext = !!getNextStep(currentStep?.id || "");
  const canGoPrevious = !!getPreviousStep(currentStep?.id || "");

  const value: TutorialContextType = {
    isActive: tutorialProgress?.isActive || false,
    isCompleted: tutorialProgress?.isCompleted || false,
    currentStep,
    currentPage,
    completedSteps: tutorialProgress?.completedSteps || [],
    currentStepNumber,
    totalSteps,
    progress,
    startTutorial,
    nextStep,
    previousStep,
    goToStep,
    skipPage,
    completeTutorial,
    dismissTutorial,
    reactivateTutorial,
    isStepCompleted,
    canGoNext,
    canGoPrevious,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error("useTutorial must be used within a TutorialProvider");
  }
  return context;
};
