import { LucideIcon } from "lucide-react";

interface RecommendationCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText: string;
  variant: "urgent" | "info" | "suggestion";
  onAction: () => void;
}

export default function RecommendationCard({
  icon: Icon,
  title,
  description,
  actionText,
  variant,
  onAction,
}: RecommendationCardProps) {
  const colors = {
    urgent: {
      bg: "bg-[#FFF4ED]",
      badge: "bg-[#FF6B35] text-white",
      icon: "text-[#FF6B35]",
    },
    info: {
      bg: "bg-[#F0F7FF]",
      badge: "bg-[#130261] text-white",
      icon: "text-[#130261]",
    },
    suggestion: {
      bg: "bg-[#F5F7FA]",
      badge: "bg-[#666666] text-white",
      icon: "text-[#666666]",
    },
  };

  const style = colors[variant];

  return (
    <div
      className={`${style.bg} rounded-[16px] p-4 sm:p-5 flex items-start gap-3 sm:gap-4 border border-gray-100`}
    >
      <div
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white flex items-center justify-center shrink-0`}
      >
        <Icon size={18} className={`sm:w-5 sm:h-5 ${style.icon}`} />
      </div>
      <div className="flex-1 flex flex-col gap-1.5 sm:gap-2 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
          <p className="font-semibold text-xs sm:text-sm text-[#130261] flex-1 min-w-0">{title}</p>
          <span
            className={`px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${style.badge} whitespace-nowrap shrink-0`}
          >
            {variant === "urgent"
              ? "Urgente"
              : variant === "info"
                ? "IA"
                : "Consejo"}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-[#666666]">{description}</p>
        <button
          onClick={onAction}
          className="text-xs sm:text-sm text-primary hover:underline w-fit"
        >
          {actionText} →
        </button>
      </div>
    </div>
  );
}

