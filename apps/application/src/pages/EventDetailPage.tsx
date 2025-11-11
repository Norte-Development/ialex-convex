import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import EventHeader from "@/components/eventos/EventHeader";
import EventDetailsCard from "@/components/eventos/EventDetailsCard";
import EventParticipantsCard from "@/components/eventos/EventParticipantsCard";
import EventRemindersCard from "@/components/eventos/EventRemindersCard";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");

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
  const updateEvent = useMutation(api.functions.events.updateEvent);
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
      audiencia: "Audiencia",
      plazo: "Plazo",
      reunion_cliente: "Reunión Cliente",
      presentacion: "Presentación",
      reunion_equipo: "Reunión Equipo",
      personal: "Personal",
      otro: "Otro",
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
      <Badge variant={variants[status] || "default"}>
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

  const handleStartEditDescription = () => {
    setEditedDescription(event?.description || "");
    setIsEditingDescription(true);
  };

  const handleSaveDescription = async () => {
    try {
      await updateEvent({
        eventId: id as Id<"events">,
        description: editedDescription || undefined,
      });
      toast.success("Descripción actualizada");
      setIsEditingDescription(false);
    } catch (error) {
      toast.error("No se pudo actualizar la descripción");
    }
  };

  const handleCancelEditDescription = () => {
    setIsEditingDescription(false);
    setEditedDescription("");
  };

  return (
    <div className="max-w-[90%] mx-auto py-8  bg-white min-h-screen">
      <EventHeader
        title={event.title}
        eventType={event.eventType}
        status={event.status}
        isOrganizer={isOrganizer}
        onBack={() => navigate(-1)}
        onMarkComplete={handleMarkComplete}
        onCancel={handleCancel}
        onDelete={handleDelete}
        getEventTypeLabel={getEventTypeLabel}
        getStatusBadge={getStatusBadge}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información principal */}
        <div className="lg:col-span-2 space-y-6">
          <EventDetailsCard
            event={event}
            isOrganizer={isOrganizer}
            isEditingDescription={isEditingDescription}
            editedDescription={editedDescription}
            onStartEditDescription={handleStartEditDescription}
            onSaveDescription={handleSaveDescription}
            onCancelEditDescription={handleCancelEditDescription}
            onDescriptionChange={setEditedDescription}
            formatDate={formatDate}
            formatTime={formatTime}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <EventParticipantsCard
            eventId={id!}
            participants={participants}
            isOrganizer={isOrganizer}
            currentUserId={user?._id as Id<"users"> | undefined}
            onRemoveParticipant={handleRemoveParticipant}
          />

          {event.reminderMinutes && event.reminderMinutes.length > 0 && (
            <EventRemindersCard reminderMinutes={event.reminderMinutes} />
          )}
        </div>
      </div>
    </div>
  );
}
