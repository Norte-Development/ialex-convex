import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface UsageMeterProps {
  used: number;
  limit: number;
  label: string;
  showPercentage?: boolean;
  className?: string;
}

/**
 * Progress bar visualization for usage limits with color coding
 * 
 * - Green: < 80% usage
 * - Yellow: 80-99% usage
 * - Red: 100% usage
 * - Shows "Ilimitado" for Infinity limits
 * 
 * @param used - Current usage count
 * @param limit - Maximum allowed (can be Infinity)
 * @param label - Label for the meter
 * @param showPercentage - Whether to show percentage (default: true)
 * 
 * @example
 * ```tsx
 * <UsageMeter used={5} limit={10} label="Casos" />
 * <UsageMeter used={100} limit={Infinity} label="Documentos" />
 * ```
 */
export function UsageMeter({
  used,
  limit,
  label,
  showPercentage = true,
  className,
}: UsageMeterProps) {
  // Handle unlimited limits
  const isUnlimited = limit === Infinity;
  const percentage = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  
  // Determine color based on usage
  const getColorClasses = (): string => {
    if (isUnlimited) return "bg-green-500";
    if (percentage >= 100) return "bg-red-500";
    if (percentage >= 80) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-600">
          { `${used.toFixed(1)}` } / {isUnlimited ? "Ilimitado" : limit.toFixed(1)}
        </span>
      </div>
      
      {!isUnlimited && (
        <>
          <Progress
            value={percentage}
            className="h-2 bg-gray-200"
          >
            <div
              className={cn("h-full transition-all", getColorClasses())}
              style={{ width: `${percentage}%` }}
            />
          </Progress>
          
          {showPercentage && (
            <div className="text-right text-xs text-gray-500">
              {percentage.toFixed(2)}% usado
            </div>
          )}
        </>
      )}
      
      {isUnlimited && (
        <div className="text-sm text-green-600 font-medium">
          ✓ Ilimitado
        </div>
      )}
    </div>
  );
}

