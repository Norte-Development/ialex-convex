import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  Calendar,
  Clock,
  MapPin,
  Link as LinkIcon,
  Users,
  ArrowLeft,
  Trash2,
  CheckCircle,
  XCircle,
  UserMinus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import AddParticipantDialog from "@/components/eventos/AddParticipantDialog";
import { useAuth } from "@/context/AuthContext";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const event = useQuery(
    api.functions.events.getEventById,
    id ? { eventId: id as Id<"events"> } : "skip",
  );

  const participants = useQuery(
    api.functions.events.getEventParticipants,
    id ? { eventId: id as Id<"events"> } : "skip",
  );

  const deleteEvent = useMutation(api.functions.events.deleteEvent);
  const updateStatus = useMutation(api.functions.events.updateEventStatus);
  const removeParticipant = useMutation(api.functions.events.removeParticipant);

  // Verificar si el usuario actual es organizador
  const currentUserParticipation = participants?.find(
    (p) => p.userId === user?._id,
  );
  const isOrganizer = currentUserParticipation?.role === "organizador";

  if (!event) {
    return (
      <div className="container mx-auto py-8 px-4 pt-24">
        <div className="text-center">Cargando evento...</div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      audiencia: "🏛️ Audiencia",
      plazo: "⏰ Plazo",
      reunion_cliente: "👥 Reunión Cliente",
      presentacion: "📄 Presentación",
      reunion_equipo: "👨‍💼 Reunión Equipo",
      personal: "🙋 Personal",
      otro: "📌 Otro",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      programado: "default",
      completado: "secondary",
      cancelado: "destructive",
      reprogramado: "outline",
    };
    return (
      <Badge
        variant={variants[status] || "default"}
        className="text-base px-3 py-1"
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de que quieres eliminar este evento?")) return;

    try {
      await deleteEvent({ eventId: id as Id<"events"> });
      toast.success("Evento eliminado");
      navigate("/eventos");
    } catch (error) {
      toast.error("No se pudo eliminar el evento");
    }
  };

  const handleMarkComplete = async () => {
    try {
      await updateStatus({
        eventId: id as Id<"events">,
        status: "completado",
      });
      toast.success("Evento completado");
    } catch (error) {
      toast.error("No se pudo actualizar el estado");
    }
  };

  const handleCancel = async () => {
    try {
      await updateStatus({
        eventId: id as Id<"events">,
        status: "cancelado",
      });
      toast.success("Evento cancelado");
    } catch (error) {
      toast.error("No se pudo cancelar el evento");
    }
  };

  const handleRemoveParticipant = async (
    userId: Id<"users">,
    userName: string,
  ) => {
    if (!confirm(`¿Remover a ${userName} del evento?`)) return;

    try {
      await removeParticipant({
        eventId: id as Id<"events">,
        userId,
      });
      toast.success("Participante removido");
    } catch (error) {
      toast.error("No se pudo remover el participante");
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 pt-24 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft size={16} className="mr-2" />
          Volver
        </Button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
            <div className="flex items-center gap-3">
              <span className="text-lg">
                {getEventTypeLabel(event.eventType)}
              </span>
              {getStatusBadge(event.status)}
            </div>
          </div>

          <div className="flex gap-2">
            {event.status === "programado" && (
              <>
                <Button variant="outline" onClick={handleMarkComplete}>
                  <CheckCircle size={16} className="mr-2" />
                  Completar
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  <XCircle size={16} className="mr-2" />
                  Cancelar
                </Button>
              </>
            )}
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 size={16} className="mr-2" />
              Eliminar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Información principal */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalles del Evento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar size={20} className="text-muted-foreground mt-1" />
                <div>
                  <p className="font-semibold">Fecha</p>
                  <p className="text-muted-foreground">
                    {formatDate(event.startDate)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock size={20} className="text-muted-foreground mt-1" />
                <div>
                  <p className="font-semibold">Horario</p>
                  <p className="text-muted-foreground">
                    {formatTime(event.startDate)} - {formatTime(event.endDate)}
                    {event.allDay && " (Todo el día)"}
                  </p>
                </div>
              </div>

              {event.location && (
                <div className="flex items-start gap-3">
                  <MapPin size={20} className="text-muted-foreground mt-1" />
                  <div>
                    <p className="font-semibold">Ubicación</p>
                    <p className="text-muted-foreground">{event.location}</p>
                  </div>
                </div>
              )}

              {event.isVirtual && event.meetingUrl && (
                <div className="flex items-start gap-3">
                  <LinkIcon size={20} className="text-muted-foreground mt-1" />
                  <div>
                    <p className="font-semibold">Reunión Virtual</p>
                    <a
                      href={event.meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {event.meetingUrl}
                    </a>
                  </div>
                </div>
              )}

              {event.description && (
                <>
                  <Separator />
                  <div>
                    <p className="font-semibold mb-2">Descripción</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {event.description}
                    </p>
                  </div>
                </>
              )}

              {event.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="font-semibold mb-2">Notas</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {event.notes}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Participantes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={18} />
                  Participantes ({participants?.length || 0})
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {participants && participants.length > 0 ? (
                <>
                  {participants.map((participant) => (
                    <div
                      key={participant._id}
                      className="flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-semibold">
                            {participant.user?.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {participant.user?.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {participant.role}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {participant.attendanceStatus}
                        </Badge>
                        {isOrganizer &&
                          participant.role !== "organizador" &&
                          participant.userId !== user?._id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() =>
                                handleRemoveParticipant(
                                  participant.userId,
                                  participant.user?.name || "Usuario",
                                )
                              }
                            >
                              <UserMinus
                                size={14}
                                className="text-destructive"
                              />
                            </Button>
                          )}
                      </div>
                    </div>
                  ))}

                  {isOrganizer && (
                    <>
                      <Separator className="my-3" />
                      <AddParticipantDialog
                        eventId={id as Id<"events">}
                        existingParticipants={participants}
                      />
                    </>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    No hay participantes
                  </p>
                  {isOrganizer && (
                    <AddParticipantDialog
                      eventId={id as Id<"events">}
                      existingParticipants={[]}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recordatorios */}
          {event.reminderMinutes && event.reminderMinutes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock size={18} />
                  Recordatorios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {event.reminderMinutes.map((minutes, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      •{" "}
                      {minutes < 60
                        ? `${minutes} minutos antes`
                        : minutes < 1440
                          ? `${Math.floor(minutes / 60)} horas antes`
                          : `${Math.floor(minutes / 1440)} días antes`}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
