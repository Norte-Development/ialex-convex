import { Badge } from "@/components/ui/badge";
import { Crown, Users, User } from "lucide-react";
import { PlanType } from "./types";
import { cn } from "@/lib/utils";

interface PlanBadgeProps {
  plan: PlanType;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const PLAN_CONFIG: Record<PlanType, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "default" | "secondary" | "outline";
  colorClasses: string;
}> = {
  free: {
    label: "Gratuito",
    icon: User,
    variant: "secondary",
    colorClasses: "bg-gray-200 text-gray-700 border-gray-300",
  },
  premium_individual: {
    label: "Premium Individual",
    icon: Crown,
    variant: "default",
    colorClasses: "bg-blue-500 text-white border-blue-600",
  },
  premium_team: {
    label: "Premium Equipo",
    icon: Users,
    variant: "default",
    colorClasses: "bg-purple-500 text-white border-purple-600",
  },
};

const SIZE_CLASSES = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-3 py-1",
  lg: "text-base px-4 py-1.5",
};

/**
 * Visual badge component to display the current billing plan
 * 
 * @param plan - The plan type to display
 * @param size - Size variant (sm, md, lg)
 * @param className - Additional CSS classes
 * 
 * @example
 * ```tsx
 * <PlanBadge plan="premium_team" size="md" />
 * ```
 */
export function PlanBadge({ plan, size = "md", className }: PlanBadgeProps) {
  const config = PLAN_CONFIG[plan];
  const Icon = config.icon;

  return (
    <Badge
      className={cn(
        config.colorClasses,
        SIZE_CLASSES[size],
        "flex items-center gap-1.5",
        className
      )}
    >
      <Icon className="size-3" />
      <span>{config.label}</span>
    </Badge>
  );
}

