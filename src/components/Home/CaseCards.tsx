interface CaseCardsProps {
  name: string;
}

export default function CaseCards({ name }: CaseCardsProps) {
  return (
    <div className="h-28 w-56 bg-[#f7f7f7] flex  justify-center shadow-md rounded-lg p-4 cursor-pointer">
      <p>{name}</p>
    </div>
  );
}
