import {
  UserIcon,
  Settings,
  UsersRound,
  FileSearch2,
  BookCheck,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import Breadcrumbs from "./BreadCrumbs";
import { Link } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { useLayout } from "@/context/LayoutContext";

export default function NavBar() {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const { setIsInCaseContext, isInCaseContext } = useLayout();

  const handleNavigationFromNavBar = () => {
    setIsInCaseContext(false);
  };

  const isInCaseRoute = location.pathname.includes("/caso/");

  return (
    <nav
      className={`${isInCaseContext ? "flex flex-row-reverse" : "flex "} fixed px-5 justify-between items-center h-14 w-full bg-background text-foreground border-b border-border top-0 left-0 z-50`}
    >
      <div className={` flex  items-center gap-4`}>
        <Settings className="cursor-pointer" size={20} />
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-8 h-8",
            },
          }}
          showName={false}
        />
      </div>
      <div className={`flex gap-4 justify-center items-center `}>
        {isInCaseRoute ? (
          <div className="text-xl font-bold text-black flex items-center gap-2">
            <Breadcrumbs />
          </div>
        ) : isHome || !isInCaseContext ? (
          <div className="flex gap-4">
            <Link to="/base-de-datos" onClick={handleNavigationFromNavBar}>
              <FileSearch2 className="cursor-pointer" size={20} />
            </Link>
            <Link to="/clientes" onClick={handleNavigationFromNavBar}>
              <UserIcon
                fill="currentColor"
                className="cursor-pointer"
                size={20}
              />
            </Link>
            <Link to="/modelos" onClick={handleNavigationFromNavBar}>
              <BookCheck size={20} className="cursor-pointer" />
            </Link>
            <Link to="/equipo" onClick={handleNavigationFromNavBar}>
              <UsersRound className="cursor-pointer" size={20} />
            </Link>
          </div>
        ) : (
          // No mostramos nada si estamos en contexto de caso
          <div></div>
        )}
      </div>
    </nav>
  );
}
