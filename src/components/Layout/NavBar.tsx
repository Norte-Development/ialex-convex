import {
  UserIcon,
  Settings,
  UsersRound,
  CircleUserRound,
  TvMinimalPlay,
  FileSearch2,
} from "lucide-react";

export default function NavBar() {
  return (
    <nav className="flex px-5 justify-between items-center h-9 w-full bg-background text-foreground border-b border-border shadow-md">
      <div className="flex gap-4">
        <Settings className="cursor-pointer" size={20} />
        <CircleUserRound className="cursor-pointer" size={20} />
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
