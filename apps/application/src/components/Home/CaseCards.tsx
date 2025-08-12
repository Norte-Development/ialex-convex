import { Link } from "react-router-dom";

interface CaseCardsProps {
  id: string;
  name: string;
}

export default function CaseCards({ id, name }: CaseCardsProps) {
  return (
    <Link to={`/caso/${id}`}>
      <div className="h-28 w-56 bg-[#f7f7f7] flex  justify-center shadow-md rounded-lg p-4 cursor-pointer">
        <p>{name}</p>
      </div>
    </Link>
  );
}
