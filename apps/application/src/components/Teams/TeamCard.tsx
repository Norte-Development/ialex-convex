import { Link } from "react-router-dom";

export default function TeamCard({ team }: { team: any }) {
  return (
    <Link
      to={`/equipos/${team._id}`}
      className="h-[54px] 2xl:h-[108px] cursor-pointer flex justify-center items-center bg-white w-[208px] 2xl:w-[233px] rounded-xl"
      style={{
        boxShadow: "0px 4.27px 12.82px -4.27px #638CF333",
      }}
    >
      <span className=" font-[500] text-[15px] text-[#130261]">
        {team.name}
      </span>
    </Link>
  );
}
