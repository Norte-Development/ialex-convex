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
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Breadcrumbs from "./BreadCrumbs";
import { UserButton } from "@clerk/clerk-react";
import { Input } from "@/components/ui/input";
import CollapsibleMenuButton from "./CollapsibleMenuButton";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import SearchDropdown from "@/components/Search/SearchDropdown";
import SearchPopup from "./SearchPopup";
import { useChatbot } from "@/context/ChatbotContext";
import { useTutorial } from "@/context/TutorialContext";

export default function NavBar() {
  const location = useLocation();
  const { isActive, currentStepNumber } = useTutorial();
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
    </>
  );
}
