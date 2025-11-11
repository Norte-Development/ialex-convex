import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import EventActionsDropdown from "./EventActionsDropdown";

interface EventHeaderProps {
  title: string;
  eventType: string;
  status: string;
  isOrganizer: boolean;
  onBack: () => void;
  onMarkComplete: () => void;
  onCancel: () => void;
  onDelete: () => void;
  getEventTypeLabel: (type: string) => string;
  getStatusBadge: (status: string) => JSX.Element;
}

export default function EventHeader({
  title,
  eventType,
  status,
  isOrganizer,
  onBack,
  onMarkComplete,
  onCancel,
  onDelete,
  getEventTypeLabel,
  getStatusBadge,
}: EventHeaderProps) {
  return (
    <div className="mb-8">
      <Button variant="ghost" onClick={onBack} className="mb-6 -ml-2">
        <ArrowLeft size={16} className="mr-2" />
        Volver
      </Button>

      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">{title}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {getEventTypeLabel(eventType)}
            </span>
            {getStatusBadge(status)}
          </div>
        </div>

        {isOrganizer && (
          <EventActionsDropdown
            eventStatus={status}
            onMarkComplete={onMarkComplete}
            onCancel={onCancel}
            onDelete={onDelete}
          />
        )}
      </div>
    </div>
  );
}
