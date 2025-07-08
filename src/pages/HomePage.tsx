import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import ExistingUserHome from "@/components/Home/ExistingUserHome";
import NewUserHome from "@/components/Home/NewUserHome";

export default function HomePage() {
  const { user } = useAuth();
  console.log(user);
  return (
    <section className="flex flex-col min-h-screen bg-white justify-center items-center relative">
      {/* Mancha azul decorativa */}
      <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-blue-500 rounded-full blur-3xl opacity-30 z-10"></div>

      <div className="w-3/4 flex flex-col gap-8 items-center justify-center">
        <div className="flex flex-col gap-8 w-full justify-center items-center">
          <h1 className=" font-poppins  font-bold lg:text-4xl text-xl">
            {" "}
            {user !== null
              ? "¡Buenos dias " + user?.name + "!"
              : "¡Bienvenido/a a iAlex!"}
          </h1>
          <Textarea
            placeholder=" ¿En qué trabajamos hoy?"
            className="min-h-[100px] max-h-[250px] overflow-y-auto bg-[#f7f7f7]"
          />
        </div>
        {user?.isNewUser || user === null ? (
          <NewUserHome />
        ) : (
          <ExistingUserHome />
        )}
      </div>
    </section>
  );
}
