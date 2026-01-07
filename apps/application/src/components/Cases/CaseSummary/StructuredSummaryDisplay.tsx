import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CaseSummaryContent } from "./types";
import {
  getPhaseLabel,
  getUrgencyBadge,
  getStatusIcon,
  getActionConfig,
  getImportanceBadge,
  getPriorityBadge,
  generateActionPrompt,
} from "./helpers";

interface StructuredSummaryDisplayProps {
  content: CaseSummaryContent;
  onActionClick?: (prompt: string) => void;
}

export function StructuredSummaryDisplay({
  content,
  onActionClick,
}: StructuredSummaryDisplayProps) {
  return (
    <div className="space-y-6">
      {/* Current Status Card */}
      <div className="bg-gradient-to-r from-tertiary/5 to-tertiary/10 rounded-lg p-4 border border-tertiary/20">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-tertiary" />
            Estado Actual
          </h4>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {getPhaseLabel(content.currentStatus.phase)}
            </Badge>
            {getUrgencyBadge(content.currentStatus.urgency)}
          </div>
        </div>
        <p className="text-gray-700 text-sm leading-relaxed">
          {content.currentStatus.summary}
        </p>
      </div>

      {/* Key Facts */}
      {content.keyFacts.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-tertiary" />
            Hechos Clave
          </h4>
          <ul className="space-y-2">
            {content.keyFacts.map((item, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 rounded-md p-2"
              >
                {getImportanceBadge(item.importance)}
                <span>{item.fact}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Relevant Actions */}
      {content.relevantActions.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-tertiary" />
            Acciones Relevantes
          </h4>
          <ul className="space-y-2">
            {content.relevantActions.map((item, index) => (
              <li
                key={index}
                className="flex items-center gap-3 text-sm text-gray-700 bg-gray-50 rounded-md p-2"
              >
                {getStatusIcon(item.status)}
                <span className="flex-1">{item.action}</span>
                {item.date && (
                  <span className="text-xs text-gray-500">{item.date}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Steps */}
      {content.nextSteps.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-tertiary" />
            Próximos Pasos
          </h4>
          <div className="space-y-3">
            {content.nextSteps.map((item, index) => {
              const actionConfig = getActionConfig(item.actionType);
              const Icon = actionConfig.icon;

              return (
                <div
                  key={index}
                  className="flex items-start gap-3 bg-white border rounded-lg p-3 shadow-sm"
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full border",
                      actionConfig.color,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-gray-900">
                        {item.step}
                      </span>
                      {getPriorityBadge(item.priority)}
                    </div>
                    {item.deadline && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.deadline}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("text-xs gap-1", actionConfig.color)}
                    onClick={() => {
                      const prompt = generateActionPrompt(
                        item.step,
                        item.actionType,
                      );
                      onActionClick?.(prompt);
                    }}
                  >
                    <Icon className="h-3 w-3" />
                    {actionConfig.label}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
