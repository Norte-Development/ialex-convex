import {
  UserIcon,
  Settings,
  UsersRound,
  FileSearch2,
  BookCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useMatch } from "react-router-dom";
import { useLocation } from "react-router-dom";
import Breadcrumbs from "./BreadCrumbs";
import { Link } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";

export default function NavBar() {
  const { user } = useAuth();
  const match = useMatch("/");
  const path = match?.pathname;
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <nav
      className={`${path === "/" ? "flex " : "flex flex-row-reverse"} px-5 justify-between items-center h-14 w-full bg-background text-foreground border-b border-border  fixed top-0 left-0 z-50`}
    >
      <div className={` flex  items-center gap-4`}>
        <Settings className="cursor-pointer" size={20} />
        <UserButton 
          appearance={{
            elements: {
              avatarBox: "w-8 h-8"
            }
          }}
          showName={false}
        />
      </div>
      <div className={`flex gap-4 justify-center items-center `}>
        {!isHome ? (
          <div className="text-xl font-bold text-black flex items-center gap-2">
            <Breadcrumbs />
          </div>
        ) : (
          <div className={`flex gap-4 ${path === "/" ? "" : "hidden"}`}>
            <Link to="/base-de-datos">
              <FileSearch2 className="cursor-pointer" size={20} />
            </Link>
            <Link to="/clientes">
              <UserIcon
                fill="currentColor"
                className="cursor-pointer"
                size={20}
              />
            </Link>
            <Link to="/modelos">
              <BookCheck size={20} className="cursor-pointer" />
            </Link>
            <UsersRound className="cursor-pointer" size={20} />
          </div>
        )}
      </div>
    </nav>
  );
}
