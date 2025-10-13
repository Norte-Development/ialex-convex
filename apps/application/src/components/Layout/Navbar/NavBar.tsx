import { Bell, Search, MessageCircle, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import Breadcrumbs from "./BreadCrumbs";
import { UserButton } from "@clerk/clerk-react";
import { Input } from "@/components/ui/input";
import CollapsibleMenuButton from "./CollapsibleMenuButton";
import { useChatbot } from "@/context/ChatbotContext";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import SearchDropdown from "@/components/Search/SearchDropdown";

export default function NavBar() {
  const location = useLocation();
  const { toggleChatbot } = useChatbot();
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

  const isInCaseContext = location.pathname.includes("/caso/");

  const menuOptions = [
    { label: "Inicio", path: "/" },
    { label: "Equipos", path: "/equipos" },
    { label: "Clientes", path: "/clientes" },
    { label: "Casos", path: "/casos" },
    { label: "Modelos", path: "/modelos" },
    { label: "Biblioteca", path: "/biblioteca" },
    { label: "Legales", path: "/base-de-datos" },
    { label: "Preferencias", path: "/preferencias" },
  ];

  return (
    <nav
      className={`flex flex-row-reverse fixed px-5 justify-between items-center h-14 w-full bg-background text-foreground border-b border-border top-0 left-0 z-50 mb-5`}
    >
      <div className={` flex  items-center gap-5`}>
        <div className="flex items-center justify-center gap-2">
          <Bell className="cursor-pointer" size={20} />
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-8 h-8",
              },
            }}
            showName={false}
          />
        </div>
        {isInCaseContext && (
          <button
            onClick={toggleChatbot}
            className="  text-[#3946D7] cursor-pointer p-2 rounded-full transition-all duration-200 hover:scale-105"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
        )}
      </div>
      <div className={`flex justify-center items-center relative w-[30%]`}>
        <Input
          placeholder="Buscar"
          className="w-full rounded-full placeholder:text-[14px] h-fit pr-20"
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
      <div className={`flex gap-4 justify-center items-center `}>
        {isInCaseContext ? (
          <div className="text-xl font-bold text-black flex items-center gap-2">
            <Breadcrumbs />
          </div>
        ) : (
          <div className="flex gap-4">
            <CollapsibleMenuButton options={menuOptions} />
          </div>
        )}
      </div>
    </nav>
  );
}
