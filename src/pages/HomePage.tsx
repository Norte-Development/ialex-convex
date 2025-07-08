import { Textarea } from "@/components/ui/textarea";
export default function HomePage() {
  return (
    <section className="flex flex-col min-h-screen bg-white justify-center items-center relative">
      {/* Mancha azul decorativa */}
      <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-blue-500 rounded-full blur-3xl opacity-30 z-10"></div>

      <div className="w-1/2 flex flex-col gap-4 items-center justify-center">
        <div className="flex flex-col gap-8 w-full justify-center items-center">
          <h1 className=" font-poppins  font-bold lg:text-4xl text-xl">
            {" "}
            ¡Bienvenido/a a iAlex!
          </h1>
          <Textarea
            placeholder=" ¿En qué trabajamos hoy?"
            className="min-h-[100px] max-h-[250px] overflow-y-auto"
          />
        </div>
        <div className="flex w-full  ">
          <div className="w-1/2 text-[#406df5] flex flex-col justify-center items-center">
            <p className="font-bold text-xl">Como preguntarle a la IA</p>
            <ul className="list-disc pl-5 marker:text-[#406df5]">
              <li>preguntas comunes</li>
              <li>biblioteca de prompts</li>
            </ul>
          </div>
          <div className="w-1/2 text-[#406df5] flex flex-col justify-center items-center">
            <p className="font-bold text-xl">Como preguntarle a la IA</p>
            <ul className="list-disc pl-5 marker:text-[#406df5]">
              <li>preguntas comunes</li>
              <li>biblioteca de prompts</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
