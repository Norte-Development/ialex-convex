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

  const isInCaseRoute = location.pathname.includes("/caso/");

  return (
    <nav
      className={`${isInCaseRoute ? "flex flex-row-reverse" : "flex"} px-5 justify-between items-center h-14 w-full bg-background text-foreground border-b border-border   top-0 left-0 z-50`}
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
        ) : (
          <div className="flex gap-4">
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
            <Link to="/equipo">
              <UsersRound className="cursor-pointer" size={20} />
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
