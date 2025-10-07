import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import ExistingUserHome from "@/components/Home/ExistingUserHome";
import NewUserHome from "@/components/Home/NewUserHome";
import { CircleArrowUp } from "lucide-react";

export default function HomePage() {
  const { user } = useAuth();

  // This component will only render when user is authenticated and loaded
  // Show new user experience if they're missing key info or just completed onboarding
  const isNewUserExperience = !user?.isOnboardingComplete;

  return (
    <section className="flex flex-col min-h-screen w-full overflow-y-hidden bg-white justify-center items-center relative pt-20">
      <div className="w-3/4 flex flex-col gap-8 items-center justify-center">
        <div className="flex flex-col gap-8 w-full justify-center items-center">
          <h1 className="font-poppins font-bold lg:text-4xl text-xl">
            ¡Buenos días, {user?.name}!
          </h1>
          <div className="relative w-full">
            <Textarea
              placeholder=" ¿En qué trabajamos hoy?"
              className="min-h-[100px] max-h-[250px] overflow-y-auto bg-[#f7f7f7] pl-10"
            />
            <CircleArrowUp
              className="absolute right-3 bottom-3 text-black pointer-events-none"
              size={20}
            />
          </div>
        </div>
        {isNewUserExperience ? <NewUserHome /> : <ExistingUserHome />}
      </div>
    </section>
  );
}
