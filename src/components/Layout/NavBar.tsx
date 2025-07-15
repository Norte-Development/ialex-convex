import {
  UserIcon,
  Settings,
  UsersRound,
  CircleUserRound,
  FileSearch2,
  BookCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLayout } from "@/context/LayoutContext";
import { useMatch } from "react-router-dom";
import { useLocation } from "react-router-dom";
import Breadcrumbs from "./BreadCrumbs";

export default function NavBar() {
  const { login } = useAuth();
  const { toggleSidebar } = useLayout();
  const match = useMatch("/");
  const path = match?.pathname;
  const location = useLocation();
  const isHome = location.pathname === "/";

  const handleLogin = () => {
    login({
      id: "1",
      name: "Agus",
      email: "agus@example.com",
      isNewUser: false,
    });
    console.log("Logueado como usuario habitual");
  };
  return (
    <nav
      className={`${path === "/" ? "flex " : "flex flex-row-reverse"} px-5 justify-between items-center h-14 w-full bg-background text-foreground border-b border-border  fixed top-0 left-0 z-50`}
    >
      <div className={` flex  items-center gap-4`}>
        <Settings className="cursor-pointer" size={20} />
        <button onClick={handleLogin}>
          <CircleUserRound className="cursor-pointer" size={20} />
        </button>
      </div>
      <div className={`flex gap-4 justify-center items-center `}>
        {!isHome ? (
          <div className="text-xl font-bold text-black flex items-center gap-2">
            <Breadcrumbs />
          </div>
        ) : (
          <div className={`flex gap-4 ${path === "/" ? "" : "hidden"}`}>
            <button onClick={toggleSidebar}>
              <FileSearch2 className="cursor-pointer" size={20} />
            </button>
            <UserIcon
              fill="currentColor"
              className="cursor-pointer"
              size={20}
            />
            <BookCheck size={20} className="cursor-pointer" />
            <UsersRound className="cursor-pointer" size={20} />
          </div>
        )}
      </div>
    </nav>
  );
}
