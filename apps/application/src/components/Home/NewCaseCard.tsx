import { Link } from "react-router-dom";
import { CircleArrowRight } from "lucide-react";
import { Badge } from "../ui/badge";
import { FileArchive, UserCheck, Clock } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useQuery } from "convex/react";

export default function NewCaseCard({ caseItem }: { caseItem: any }) {
  console.log("Cases", caseItem);

  const user = useQuery(api.functions.users.getUserById, {
    userId: caseItem.createdBy,
  });

  // Format timestamp to readable date
  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return "Sin fecha de fin";
    const date = new Date(timestamp);
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <Link
      to={`/caso/${caseItem._id}`}
      className="h-[129px] cursor-pointer flex flex-col justify-between items-center w-[233px] bg-[#E2EFF7] rounded-2xl group"
    >
      <div className="text-[10px]  mt-3 w-full px-6 flex flex-col justify-center items-start">
        <p className="font-bold mb-3 text-[12px] truncate w-full">
          {caseItem.title}
        </p>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <FileArchive size={14} />
            <span className="truncate">0000000000</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <UserCheck size={14} />
              <span className="truncate">{user?.name}</span>
            </div>
            {caseItem.endDate && (
              <div className="flex items-center gap-1">
                <Clock size={14} />
                <span className="truncate">{formatDate(caseItem.endDate)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="w-full h-[40px] pl-3 flex justify-between items-center bg-[#f4f7fc] ">
        <Badge
          variant={"outline"}
          className="mr-3 text-[#5E47D2] border-[#BCB0F5]"
        >
          {caseItem.status}
        </Badge>
        <div className="flex items-center justify-center gap-2">
          <span className=" font-bold text-[14px] group-hover:text-tertiary group-hover:scale-110 transition-all  duration-300">
            Ver mas
          </span>
          <CircleArrowRight
            className="mr-3 group-hover:text-tertiary group-hover:scale-110 transition-all duration-300"
            size={16}
          />
        </div>
      </div>
    </Link>
  );
}
