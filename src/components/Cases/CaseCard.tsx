import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface CaseCardProps {
  caseId: Id<"cases">;
  title: string;
  status: string;
}

export default function CaseCard({ caseId, title, status }: CaseCardProps) {
  const clients = useQuery(api.functions.cases.getClientsForCase, { caseId });
  const slug = title.toLowerCase().replace(/ /g, "-");

  return (
    <div className="w-full max-w-[350px] h-48 bg-[#f7f7f7] border border-gray-200 flex flex-col justify-start shadow-md rounded-lg p-4">
      <h1 className=" font-bold h-[30%]">{title}</h1>
      <div className="flex flex-col gap-1 text-gray-500 h-[60%] overflow-y-auto">
        <div className="text-sm font-medium">Clientes:</div>
        {clients === undefined ? (
          <div className="text-xs">Cargando clientes...</div>
        ) : clients.length === 0 ? (
          <div className="text-xs">Sin clientes asignados</div>
        ) : (
          <div className="space-y-1">
            {clients.slice(0, 2).map((client, index) => (
              <div key={index} className="text-xs">
                <span className="font-medium">{client.name}</span>
                <span className="text-gray-400"> ({client.role})</span>
              </div>
            ))}
            {clients.length > 2 && (
              <div className="text-xs text-gray-400">
                +{clients.length - 2} más
              </div>
            )}
          </div>
        )}
        <div className="mt-2">
          <span
            className={
              status === "completado"
                ? "text-green-500 text-sm font-medium"
                : status === "en progreso"
                  ? "text-yellow-500 text-sm font-medium"
                  : "text-red-500 text-sm font-medium"
            }
          >
            {status}
          </span>
        </div>
      </div>
      <div className="h-[10%] flex justify-start items-center">
        <Link
          to={`/caso/${slug}`}
          className="cursor-pointer text-blue-600 hover:text-blue-800"
        >
          Ir a caso →
        </Link>
      </div>
    </div>
  );
}
