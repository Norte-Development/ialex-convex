import { Link } from "react-router-dom";

export default function TeamCard({ team }: { team: any }) {
  return (
    <Link
      to={`/equipos/${team._id}`}
      className="h-[129px] cursor-pointer flex justify-center items-end w-[233px] bg-[#E2EFF7] rounded-2xl"
    >
      <div className="w-full h-[39px] pl-3 flex justify-start items-center bg-[#f4f7fc] ">
        <span className=" font-bold">{team.name}</span>
      </div>
    </Link>
  );
}
