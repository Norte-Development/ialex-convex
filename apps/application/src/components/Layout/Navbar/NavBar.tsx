import {
  UserCheck,
  Bell,
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
import Breadcrumbs from "./BreadCrumbs";
import { UserButton } from "@clerk/clerk-react";
import { Input } from "@/components/ui/input";
import CollapsibleMenuButton from "./CollapsibleMenuButton";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import SearchDropdown from "@/components/Search/SearchDropdown";

export default function NavBar() {
  const location = useLocation();
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
    { label: "Inicio", path: "/", icon: Home },
    { label: "Equipos", path: "/equipo", icon: Users },
    { label: "Clientes", path: "/clientes", icon: UserCheck },
    { label: "Casos", path: "/casos", icon: Landmark },
    { label: "Modelos", path: "/modelos", icon: FilePen },
    { label: "Biblioteca", path: "/biblioteca", icon: FolderOpen },
    { label: "Legales", path: "/base-de-datos", icon: Database },
    { label: "Asistente IA", path: "/ai", icon: MessageCircle },
    { label: "Preferencias", path: "/preferencias", icon: Settings },
  ];

  return (
    <nav
      className={`flex flex-row-reverse ${isInCaseContext ? "bg-[#D9D9D9]" : "bg-white"} fixed px-5 justify-between items-center py-1 h-[41px] w-full  text-foreground  top-0 left-0 z-50 mb-5`}
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
      </div>
      <div className={`flex justify-center items-center relative w-[30%]`}>
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
