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
    <nav className="flex px-5  justify-between items-center h-9 w-full bg-white border-b border-gray-200 text-black shadow-md">
      <div className="flex gap-4">
        <Settings color="black" className="cursor-pointer" size={20} />
        <CircleUserRound color="black" className="cursor-pointer" size={20} />
      </div>
      <div className="flex gap-4">
        <FileSearch2 color="black" className="cursor-pointer" size={20} />
        <UserIcon
          color="black"
          fill="black"
          className="cursor-pointer"
          size={20}
        />
        <TvMinimalPlay color="black" className="cursor-pointer" size={20} />
        <UsersRound color="black" className="cursor-pointer" size={20} />
      </div>
    </nav>
  );
}
