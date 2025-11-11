import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X } from "lucide-react";

interface EventDetailsCardProps {
  event: any;
  isOrganizer: boolean;
  isEditingDescription: boolean;
  editedDescription: string;
  onStartEditDescription: () => void;
  onSaveDescription: () => void;
  onCancelEditDescription: () => void;
  onDescriptionChange: (value: string) => void;
  formatDate: (timestamp: number) => string;
  formatTime: (timestamp: number) => string;
}

export default function EventDetailsCard({
  event,
  isOrganizer,
  isEditingDescription,
  editedDescription,
  onStartEditDescription,
  onSaveDescription,
  onCancelEditDescription,
  onDescriptionChange,
  formatDate,
  formatTime,
}: EventDetailsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Detalles del Evento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Fecha */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Fecha
          </p>
          <p className="text-sm text-gray-900">{formatDate(event.startDate)}</p>
        </div>

        {/* Horario */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Horario
          </p>
          <p className="text-sm text-gray-900">
            {formatTime(event.startDate)} - {formatTime(event.endDate)}
            {event.allDay && " (Todo el día)"}
          </p>
        </div>

        {/* Ubicación */}
        {event.location && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Ubicación
            </p>
            <p className="text-sm text-gray-900">{event.location}</p>
          </div>
        )}

        {/* Reunión Virtual */}
        {event.isVirtual && event.meetingUrl && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Reunión Virtual
            </p>
            <a
              href={event.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
            >
              {event.meetingUrl}
            </a>
          </div>
        )}

        {/* Descripción */}
        {(event.description || isOrganizer) && (
          <>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Descripción
                </p>
                {isOrganizer && !isEditingDescription && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onStartEditDescription}
                  >
                    <Pencil size={14} className="mr-1" />
                    {event.description ? "Editar" : "Agregar"}
                  </Button>
                )}
              </div>
              {isEditingDescription ? (
                <div className="space-y-2">
                  <Textarea
                    value={editedDescription}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                    rows={4}
                    placeholder="Agregar una descripción..."
                    className="w-full text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={onSaveDescription}>
                      <Check size={14} className="mr-1" />
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onCancelEditDescription}
                    >
                      <X size={14} className="mr-1" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {event.description || (
                    <span className="italic text-gray-400">
                      Sin descripción
                    </span>
                  )}
                </p>
              )}
            </div>
          </>
        )}

        {/* Notas */}
        {event.notes && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Notas
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {event.notes}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
