import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import ExistingUserHome from "@/components/Home/ExistingUserHome";
import NewUserHome from "@/components/Home/NewUserHome";
import { Link } from "react-router-dom";
import { FileSearch2, UserPlus, FolderOpenDot, BookCheck, UsersRound } from "lucide-react";

export default function HomePage() {
  const { user } = useAuth();

  // This component will only render when user is authenticated and loaded
  // Show new user experience if they're missing key info or just completed onboarding
  const isNewUserExperience = !user?.isOnboardingComplete;

  return (
    <section className="flex flex-col min-h-screen w-full overflow-y-hidden bg-white justify-center items-center relative pt-20">
      {/* Mancha azul decorativa */}
      <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-blue-500 rounded-full blur-3xl opacity-30 z-10"></div>

      <div className="w-3/4 flex flex-col gap-8 items-center justify-center">
        <div className="flex flex-col gap-8 w-full justify-center items-center">
          <h1 className="font-poppins font-bold lg:text-4xl text-xl">
            ¡Buenos días, {user?.name}!
          </h1>
          <Textarea
            placeholder=" ¿En qué trabajamos hoy?"
            className="min-h-[100px] max-h-[250px] overflow-y-auto bg-[#f7f7f7]"
          />
        </div>
        {/* Acciones rápidas */}
        <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Link
            to="/casos"
            className="flex items-center gap-2 rounded-md border border-border bg-[#f7f7f7] px-3 py-2 hover:opacity-100 opacity-90 transition-opacity"
          >
            <FolderOpenDot size={18} />
            <span className="text-sm font-medium">Ver casos</span>
          </Link>
          <Link
            to="/clientes"
            className="flex items-center gap-2 rounded-md border border-border bg-[#f7f7f7] px-3 py-2 hover:opacity-100 opacity-90 transition-opacity"
          >
            <UserPlus size={18} />
            <span className="text-sm font-medium">Clientes</span>
          </Link>
          <Link
            to="/base-de-datos"
            className="flex items-center gap-2 rounded-md border border-border bg-[#f7f7f7] px-3 py-2 hover:opacity-100 opacity-90 transition-opacity"
          >
            <FileSearch2 size={18} />
            <span className="text-sm font-medium">Base de datos</span>
          </Link>
          <Link
            to="/modelos"
            className="flex items-center gap-2 rounded-md border border-border bg-[#f7f7f7] px-3 py-2 hover:opacity-100 opacity-90 transition-opacity"
          >
            <BookCheck size={18} />
            <span className="text-sm font-medium">Modelos</span>
          </Link>
          <Link
            to="/equipo"
            className="flex items-center gap-2 rounded-md border border-border bg-[#f7f7f7] px-3 py-2 hover:opacity-100 opacity-90 transition-opacity"
          >
            <UsersRound size={18} />
            <span className="text-sm font-medium">Equipo</span>
          </Link>
        </div>
        {isNewUserExperience ? <NewUserHome /> : <ExistingUserHome />}
      </div>
    </section>
  );
}
