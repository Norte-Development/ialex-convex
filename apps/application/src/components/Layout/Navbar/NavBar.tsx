import {
  UserCheck,
  // Bell,
  Search,
  MessageCircle,
  X,
  Home,
  Users,
  Database,
  Settings,
  Landmark,
  FilePen,
  FolderOpen,
  HelpCircle,
} from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Breadcrumbs from "./BreadCrumbs";
import { UserButton } from "@clerk/clerk-react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import CollapsibleMenuButton from "./CollapsibleMenuButton";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import SearchDropdown from "@/components/Search/SearchDropdown";
import SearchPopup from "./SearchPopup";
import { useChatbot } from "@/context/ChatbotContext";
import { useTutorial } from "@/context/TutorialContext";
import { NotificationsDropdown } from "@/components/Notifications";

export default function NavBar() {
  const location = useLocation();
  const {
    isActive,
    currentStepNumber,
    hasCurrentPageTutorial,
    isCurrentPageSkipped,
    reactivateTutorial,
    unskipCurrentPage,
    startTutorial,
  } = useTutorial();
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const {
    searchQuery,
    results,
    isLoading,
    isOpen,
    handleSearch,
    clearSearch,
    handleResultClick,
    setIsOpen,
  } = useGlobalSearch();

  const [isSearchPopupOpen, setIsSearchPopupOpen] = useState(false);
  const isInCaseContext = location.pathname.includes("/caso/");
  const { toggleChatbot, isChatbotOpen } = useChatbot();

  // Auto-open chatbot when tutorial reaches step 15
  useEffect(() => {
    if (isActive && currentStepNumber === 15 && !isChatbotOpen) {
      toggleChatbot();
    }
  }, [isActive, currentStepNumber, isChatbotOpen, toggleChatbot]);

  const menuOptions = [
    { label: "Inicio", path: "/", icon: Home },
    { label: "Casos", path: "/casos", icon: Landmark },
    { label: "Equipos", path: "/equipo", icon: Users },
    { label: "Clientes", path: "/clientes", icon: UserCheck },
    { label: "Modelos", path: "/modelos", icon: FilePen },
    { label: "Biblioteca", path: "/biblioteca", icon: FolderOpen },
    { label: "Base Legal", path: "/base-de-datos", icon: Database },
    { label: "Asistente IA", path: "/ai", icon: MessageCircle },
    { label: "Preferencias", path: "/preferencias", icon: Settings },
  ];

  // Handle help button click
  const handleHelpClick = () => {
    // If tutorial is active and this page was skipped, unskip it
    if (isActive && isCurrentPageSkipped && hasCurrentPageTutorial) {
      unskipCurrentPage();
      return;
    }

    // If tutorial is active, page not skipped, AND page has tutorial -> do nothing (already showing)
    if (isActive && !isCurrentPageSkipped && hasCurrentPageTutorial) {
      return;
    }

    // If tutorial is active but page has NO tutorial -> show restart dialog
    if (isActive && !hasCurrentPageTutorial) {
      setShowRestartDialog(true);
      return;
    }

    // Tutorial is not active
    if (hasCurrentPageTutorial) {
      // Current page has tutorial, reactivate it on this page
      reactivateTutorial();
    } else {
      // No tutorial for this page, ask if they want to restart from beginning
      setShowRestartDialog(true);
    }
  };

  // Determine if help button should be disabled
  // Only disabled if tutorial is active, page is not skipped, AND page has tutorial
  // If page has no tutorial, button should be enabled to allow restarting
  const isHelpButtonDisabled =
    isActive && !isCurrentPageSkipped && hasCurrentPageTutorial;

  const handleRestartTutorial = () => {
    setShowRestartDialog(false);
    startTutorial("home");
  };

  return (
    <>
      <nav
        className={`flex flex-row-reverse bg-white ${isInCaseContext ? "relative" : "fixed"} px-3 md:px-5 justify-between items-center py-1 h-[41px] w-full text-foreground ${!isInCaseContext ? "top-0 left-0" : ""} z-50`}
      >
        {/* Right Section - User Actions */}
        <div className="flex items-center gap-2 md:gap-5">
          <div className="flex items-center justify-center gap-2 md:gap-4">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsSearchPopupOpen(true)}
                className="md:hidden p-2  hover:bg-gray-100 rounded-full transition-colors"
              >
                <Search size={20} className="text-gray-600" />
              </button>

              <div className="mr-1">
                <NotificationsDropdown />
              </div>

              {/* Help/Tutorial Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleHelpClick}
                    disabled={isHelpButtonDisabled}
                    className={`p-2 cursor-pointer rounded-full transition-colors ${
                      isHelpButtonDisabled
                        ? "text-blue-500 bg-transparent cursor-default"
                        : "text-gray-600 hover:bg-transparent hover:text-blue-600"
                    }`}
                  >
                    <HelpCircle size={20} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isActive && isCurrentPageSkipped && hasCurrentPageTutorial
                    ? "Ver tutorial de esta página"
                    : isActive && hasCurrentPageTutorial
                      ? "Tutorial en progreso"
                      : isActive && !hasCurrentPageTutorial
                        ? "Reiniciar tutorial"
                        : hasCurrentPageTutorial
                          ? "Ver tutorial de esta página"
                          : "Iniciar tutorial"}
                </TooltipContent>
              </Tooltip>

              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-7 h-7 md:w-8 md:h-8",
                  },
                }}
                showName={false}
              />
            </div>
            {isInCaseContext && (
              <MessageCircle
                className="cursor-pointer"
                size={20}
                onClick={toggleChatbot}
                color="#3946D7"
              />
            )}
          </div>
        </div>

        {/* Center Section - Search */}
        <div className="flex justify-center items-center relative md:w-[30%]  md:flex-none ">
          {/* Desktop Search Bar */}
          <div className="hidden md:flex justify-center items-center relative w-full">
            <Input
              placeholder="Buscar"
              className="w-full rounded-full bg-white placeholder:text-[14px] h-fit pr-20"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => {
                if (searchQuery.trim().length > 0) {
                  setIsOpen(true);
                }
              }}
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={16} />
              </button>
            )}
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <SearchDropdown
              isOpen={isOpen}
              isLoading={isLoading}
              results={results}
              searchQuery={searchQuery}
              onResultClick={handleResultClick}
              onClose={() => setIsOpen(false)}
            />
          </div>

          {/* Mobile Search Icon */}
        </div>

        {/* Left Section - Navigation */}
        <div className="flex gap-2 md:gap-4 justify-center items-center">
          {isInCaseContext ? (
            <div className="text-base md:text-xl font-bold text-black flex items-center gap-2">
              <Breadcrumbs />
            </div>
          ) : (
            <div className="flex gap-2 md:gap-4">
              <CollapsibleMenuButton
                open={isActive && currentStepNumber === 4}
                options={menuOptions}
              />
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Search Popup */}
      <SearchPopup
        isOpen={isSearchPopupOpen}
        onClose={() => setIsSearchPopupOpen(false)}
      />

      {/* Restart Tutorial Dialog */}
      <AlertDialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar Tutorial</AlertDialogTitle>
            <AlertDialogDescription>
              Esta página no tiene tutorial específico. ¿Querés realizar el
              tutorial completo desde el principio?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestartTutorial}>
              Iniciar Tutorial
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
