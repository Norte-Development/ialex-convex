import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-[#F5F7FA] flex items-center justify-center mb-4">
        <Icon size={32} className="text-[#666666]" />
      </div>
      <p className="text-base font-medium text-[#130261] mb-2">{title}</p>
      <p className="text-sm text-[#666666] mb-4 max-w-md">{description}</p>
      {actionText && onAction && (
        <Button
          onClick={onAction}
          variant="ghost"
          className="text-[#5bb6e5] hover:text-[#4a9fcc]"
        >
          {actionText}
        </Button>
      )}
    </div>
  );
}

