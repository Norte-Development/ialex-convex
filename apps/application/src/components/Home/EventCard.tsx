import { Link } from "react-router-dom";
import { CircleArrowRight } from "lucide-react";

export default function EventCard({ event }: { event: any }) {
  return (
    <Link
      to={`/eventos/${event._id}`}
      className="h-[129px] cursor-pointer flex justify-center items-end w-[233px] bg-[#E2EFF7] rounded-2xl"
    >
      <div className="w-full h-[39px] pl-3 flex justify-between items-center bg-[#f4f7fc] ">
        <span className=" font-bold">{event.name}</span>
        <CircleArrowRight className="mr-3" />
      </div>
    </Link>
  );
}
