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

export default function NavBar() {
  const location = useLocation();

  const isInCaseContext = location.pathname.includes("/caso/");
  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <nav
      className={`${isInCaseContext ? "flex flex-row-reverse" : "flex "} fixed px-5 justify-between items-center h-14 w-full bg-background text-foreground border-b border-border top-0 left-0 z-50 mb-5`}
    >
      <div className={` flex  items-center gap-4`}>
        <Settings className="cursor-pointer" size={20} aria-hidden="true" />
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
        {isInCaseContext ? (
          <div className="text-xl font-bold text-black flex items-center gap-2">
            <Breadcrumbs />
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <Link
              to="/"
              aria-label="Inicio"
              className="flex items-center gap-2 font-semibold hover:opacity-100 opacity-90 transition-opacity"
            >
              <span>IAlex</span>
            </Link>
            <div className="flex gap-4 items-center">
              <Link
                to="/base-de-datos"
                aria-label="Base de datos"
                aria-current={isActive("/base-de-datos") ? "page" : undefined}
                title="Base de datos"
              >
                <FileSearch2
                  className={`cursor-pointer transition-opacity ${
                    isActive("/base-de-datos")
                      ? "opacity-100"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  size={20}
                />
              </Link>
              <Link
                to="/clientes"
                aria-label="Clientes"
                aria-current={isActive("/clientes") ? "page" : undefined}
                title="Clientes"
              >
                <UserIcon
                  fill="currentColor"
                  className={`cursor-pointer transition-opacity ${
                    isActive("/clientes")
                      ? "opacity-100"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  size={20}
                />
              </Link>
              <Link
                to="/modelos"
                aria-label="Modelos"
                aria-current={isActive("/modelos") ? "page" : undefined}
                title="Modelos"
              >
                <BookCheck
                  size={20}
                  className={`cursor-pointer transition-opacity ${
                    isActive("/modelos")
                      ? "opacity-100"
                      : "opacity-60 hover:opacity-100"
                  }`}
                />
              </Link>
              <Link
                to="/equipo"
                aria-label="Equipo"
                aria-current={isActive("/equipo") ? "page" : undefined}
                title="Equipo"
              >
                <UsersRound
                  className={`cursor-pointer transition-opacity ${
                    isActive("/equipo")
                      ? "opacity-100"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  size={20}
                />
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
