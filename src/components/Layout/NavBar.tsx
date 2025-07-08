import {
  UserIcon,
  Settings,
  UsersRound,
  CircleUserRound,
  TvMinimalPlay,
  FileSearch2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function NavBar() {
  const { login } = useAuth();

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
    <nav className="flex px-5 justify-between items-center h-9 w-full bg-background text-foreground border-b border-border shadow-md">
      <div className="flex gap-4">
        <Settings className="cursor-pointer" size={20} />
        <button onClick={handleLogin}>
          <CircleUserRound className="cursor-pointer" size={20} />
        </button>
      </div>
      <div className="flex gap-4">
        <FileSearch2 className="cursor-pointer" size={20} />
        <UserIcon fill="currentColor" className="cursor-pointer" size={20} />
        <TvMinimalPlay className="cursor-pointer" size={20} />
        <UsersRound className="cursor-pointer" size={20} />
      </div>
    </nav>
  );
}
