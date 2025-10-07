import { Bell, Search } from "lucide-react";
import { useLocation } from "react-router-dom";
import Breadcrumbs from "./BreadCrumbs";
import { UserButton } from "@clerk/clerk-react";
import { Input } from "@/components/ui/input";
import CollapsibleMenuButton from "./CollapsibleMenuButton";
export default function NavBar() {
  const location = useLocation();

  const isInCaseContext = location.pathname.includes("/caso/");

  const menuOptions = [
    { label: "Equipos", path: "/equipos" },
    { label: "Clientes", path: "/clientes" },
    { label: "Casos", path: "/casos" },
    { label: "Escritos", path: "/escritos" },
    { label: "Legales", path: "/legales" },
  ];

  return (
    <nav
      className={`flex flex-row-reverse fixed px-5 justify-between items-center h-14 w-full bg-background text-foreground border-b border-border top-0 left-0 z-50 mb-5`}
    >
      <div className={` flex  items-center gap-4`}>
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
      <div className={`flex justify-center items-center relative w-[30%]`}>
        <Input placeholder="Busqueda inteligente" className="w-full" />
        <Search
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          size={16}
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
