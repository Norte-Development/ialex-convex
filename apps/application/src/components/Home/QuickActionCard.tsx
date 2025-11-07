import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";

interface QuickActionCardProps {
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  variant?: "primary" | "secondary";
}

export default function QuickActionCard({
  title,
  subtitle,
  href,
  icon: Icon,
  variant = "secondary",
}: QuickActionCardProps) {
  const isPrimary = variant === "primary";

  return (
    <Link to={href}>
      <div
        className={`rounded-[20px] p-4 sm:p-6 flex flex-col gap-2 sm:gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] ${
          isPrimary
            ? "bg-[#130261] text-white"
            : "bg-white border border-gray-100"
        }`}
        style={{
          boxShadow: isPrimary
            ? "0px 4.27px 34.18px -4.27px rgba(99, 140, 243, 0.32)"
            : "0px 4.27px 12.82px -4.27px rgba(99, 140, 243, 0.20)",
        }}
      >
        <div
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center ${
            isPrimary ? "bg-white/10" : "bg-[#F5F7FA]"
          }`}
        >
          <Icon
            size={20}
            className={`sm:w-6 sm:h-6 ${isPrimary ? "text-white" : "text-[#130261]"}`}
          />
        </div>
        <div className="flex flex-col gap-0.5 sm:gap-1">
          <h3
            className={`font-semibold text-sm sm:text-base ${
              isPrimary ? "text-white" : "text-[#130261]"
            }`}
          >
            {title}
          </h3>
          <p
            className={`text-xs sm:text-sm ${
              isPrimary ? "text-white/80" : "text-[#666666]"
            }`}
          >
            {subtitle}
          </p>
        </div>
      </div>
    </Link>
  );
}

