import { Button } from "../ui";
import { Check } from "lucide-react";
import { useUpgrade } from "@/components/Billing/useUpgrade";

interface PlanCardProps {
  plan: "premium_individual" | "premium_team";
  points: string[];
  price: string;
  title: string;
  description: string;
  isFeatured?: boolean;
  onSuccess?: () => void;
}

export default function PlanCard({
  plan,
  points,
  price,
  title,
  description,
  isFeatured,
  onSuccess,
}: PlanCardProps) {
  const { upgradeToPlan, isUpgrading } = useUpgrade({
    onSuccess: () => {
      onSuccess?.();
    },
  });

  const handleUpgrade = (plan: "premium_individual" | "premium_team") => {
    upgradeToPlan({ plan, period: "monthly" });
  };

  return (
    <div className="md:h-[80%] h-[100%] md:w-[45%] w-[90%] bg-white/90 flex flex-col justify-start items-center p-4 rounded-lg">
      <div className="w-full h-[30%] gap-1  flex flex-col justify-between items-start px-2 pb-4 border-b border-dashed border-gray-500">
        <p
          className={`text-[15px] font-bold 2xl:text-lg ${isFeatured ? "text-[#1559EA]" : "text-gray-600"}`}
        >
          {title}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-2xl font-bold text-black">${price}</p>
          <p className="text-xs text-gray-500">/por mes</p>
        </div>
        <p className="text-xs 2xl:text-[15px] text-gray-500">{description}</p>
      </div>
      <div className="w-full h-full flex flex-col justify-start items-start px-2 pt-5 ">
        <div className="flex flex-col gap-6  ">
          {points.map((point, index) => (
            <p
              key={index}
              className="text-black 2xl:text-[16px] text-[11px]  md:text-[12px] flex items-center gap-1 md:gap-2"
            >
              <div className="bg-white p-0.5 rounded-full">
                <Check className="w-4 h-4" color="green" />{" "}
              </div>
              {point}
            </p>
          ))}
        </div>
      </div>
      <Button
        className={`w-full md:h-[12%] h-[10%] text-white text-xl md:text-2xl font-bold ${isFeatured ? "" : "bg-black hover:bg-black/80"}`}
        onClick={() => handleUpgrade(plan)}
        disabled={isUpgrading}
      >
        Comenzar
      </Button>
    </div>
  );
}
