import { Link } from "react-router-dom";
import { FolderOpenDot, UserPlus, FileSearch2, ListChecks } from "lucide-react";

const NewUserHome = () => {
  return (
    <div className="flex w-full gap-6 lg:gap-10">
      <div className="w-1/2 text-[#406df5] flex flex-col justify-center">
        <p className="font-bold text-xl mb-2">Empieza aquí</p>
        <div className="flex flex-col gap-2">
          <Link
            to="/casos"
            className="flex items-center gap-2 bg-[#f7f7f7] rounded-md px-3 py-2 border border-border hover:opacity-100 opacity-90 transition-opacity"
          >
            <FolderOpenDot size={18} />
            <span className="text-[#222]">Crea o revisa tu primer caso</span>
          </Link>
          <Link
            to="/clientes"
            className="flex items-center gap-2 bg-[#f7f7f7] rounded-md px-3 py-2 border border-border hover:opacity-100 opacity-90 transition-opacity"
          >
            <UserPlus size={18} />
            <span className="text-[#222]">Agrega un cliente</span>
          </Link>
          <Link
            to="/base-de-datos"
            className="flex items-center gap-2 bg-[#f7f7f7] rounded-md px-3 py-2 border border-border hover:opacity-100 opacity-90 transition-opacity"
          >
            <FileSearch2 size={18} />
            <span className="text-[#222]">Explora la base de datos</span>
          </Link>
        </div>
      </div>
      <div className="w-1/2 text-[#406df5] flex flex-col justify-center">
        <p className="font-bold text-xl mb-2">Cómo preguntarle a la IA</p>
        <ul className="list-disc pl-5 marker:text-[#406df5] text-[#222]">
          <li>Da contexto: número de expediente, juzgado, etapa procesal.</li>
          <li>Especifica el objetivo: redactar, revisar, resumir, comparar.</li>
          <li>Indica el formato esperado: puntos, borrador, checklist, email.</li>
          <li>Limita el alcance si es necesario: 3-5 bullets, 1 párrafo.</li>
        </ul>
        <div className="flex items-center gap-2 mt-3 text-[#222] opacity-80">
          <ListChecks size={16} />
          <span className="text-sm">Consejo: guarda prompts útiles como modelos.</span>
        </div>
      </div>
    </div>
  );
};

export default NewUserHome;
