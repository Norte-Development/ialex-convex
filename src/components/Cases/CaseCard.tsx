import { Link } from "react-router-dom";

interface CaseCardProps {
  title: string;
  client: string;
  status: string;
}

export default function CaseCard({ title, client, status }: CaseCardProps) {
  return (
    <div className="w-full h-48 bg-[#f7f7f7] flex flex-col justify-start   shadow-xl rounded-lg p-4 ">
      <h1 className="text-lg font-bold h-[20%]">{title}</h1>
      <div className="flex gap-2 items-center text-gray-500 h-[50%]">
        <p>Cliente : {client}</p>:
        <p
          className={
            status === "completado"
              ? "text-green-500"
              : status === "en progreso"
                ? "text-yellow-500"
                : "text-red-500"
          }
        >
          {status}
        </p>
      </div>
      <div className="h-[30%]  flex justify-start items-center">
        <Link to={`/case/${title}`} className="cursor-pointer">
          Ir a caso --&gt;
        </Link>
      </div>
    </div>
  );
}
