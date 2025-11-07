interface StatCardProps {
  value: number;
  label: string;
}

export default function StatCard({ value, label }: StatCardProps) {
  return (
    <div className="bg-white rounded-[16px] p-6 flex flex-col items-start gap-2 border border-gray-100">
      <p className="text-[40px] font-semibold text-[#130261]">{value}</p>
      <p className="text-sm font-normal text-[#666666]">{label}</p>
    </div>
  );
}

