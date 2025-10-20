import { Link } from "react-router-dom";

interface CaseCardsProps {
  id: string;
  name: string;
}

export default function CaseCards({ id, name }: CaseCardsProps) {
  return (
    <Link to={`/caso/${id}`}>
      <div 
        className="h-[54px] w-full bg-white rounded-2xl flex items-center justify-center px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors border-[1.07px] border-white"
        style={{ boxShadow: '0px 4.27px 12.82px -4.27px rgba(99, 140, 243, 0.20)' }}
      >
        <p className="text-[#130261] font-medium text-center truncate">
          {name}
        </p>
      </div>
    </Link>
  );
}
