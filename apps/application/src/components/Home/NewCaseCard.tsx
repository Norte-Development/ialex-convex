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
      className="h-[129px] 2xl:h-[190px] cursor-pointer flex flex-col justify-between items-center w-[233px] 2xl:w-[350px] bg-[#E2EFF7] rounded-2xl group"
    >
      <div className="text-[10px] 2xl:text-[14px] mt-3 2xl:mt-5 w-full px-6 2xl:px-8 flex flex-col justify-center items-start">
        <p className="font-bold mb-3 2xl:mb-4 text-[12px] 2xl:text-[18px] truncate w-full">
          {caseItem.title}
        </p>
        <div className="flex flex-col gap-1 2xl:gap-3">
          {caseItem.expedientNumber && (
            <div className="flex items-center gap-1 2xl:gap-2">
              <FileArchive size={14} className="2xl:w-6 2xl:h-6" />
              <span className="truncate">{caseItem.expedientNumber}</span>
            </div>
          )}
          <div className="flex items-center gap-4 2xl:gap-6">
            <div className="flex items-center gap-1 2xl:gap-2">
              <UserCheck size={14} className="2xl:w-6 2xl:h-6" />
              <span className="truncate">{user?.name}</span>
            </div>
            {caseItem.endDate && (
              <div className="flex items-center gap-1 2xl:gap-2">
                <Clock size={14} className="2xl:w-6 2xl:h-6" />
                <span className="truncate">{formatDate(caseItem.endDate)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="w-full h-[40px] 2xl:h-[60px] pl-3 2xl:pl-4 flex justify-between items-center bg-[#f4f7fc]">
        <Badge
          variant={"outline"}
          className="mr-3 text-[#5E47D2] border-[#BCB0F5] 2xl:text-base 2xl:px-3 2xl:py-1"
        >
          {caseItem.status}
        </Badge>
        <div className="flex items-center justify-center gap-2">
          <span className="font-bold text-[14px] 2xl:text-[18px] group-hover:text-tertiary group-hover:scale-110 transition-all duration-300">
            Ver mas
          </span>
          <CircleArrowRight
            className="mr-3 2xl:mr-4 group-hover:text-tertiary group-hover:scale-110 transition-all duration-300 2xl:w-6 2xl:h-6"
            size={16}
          />
        </div>
      </div>
    </Link>
  );
}
