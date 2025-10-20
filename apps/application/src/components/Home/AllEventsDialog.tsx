import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";

export default function AllEventsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const upcomingEvents = useQuery(
    api.functions.events.getUpcomingEvents,
    open ? { days: 90 } : "skip", // Solo cargar cuando el modal esté abierto
  );
  const allEvents = useQuery(
    api.functions.events.getMyEvents,
    open ? {} : "skip",
  );

  const allEventsData = allEvents || [];
  const events = upcomingEvents || [];

  // Filtrar por estado
  const programados = allEventsData.filter((e) => e.status === "programado");
  const completados = allEventsData.filter((e) => e.status === "completado");

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
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
      <Badge variant={variants[status] || "default"} className="text-xs">
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const EventItem = ({ event }: { event: any }) => (
    <Link
      to={`/eventos/${event._id}`}
      onClick={() => onOpenChange(false)}
      className="block"
    >
      <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm">{event.title}</h4>
              {getStatusBadge(event.status)}
            </div>
            <p className="text-xs text-muted-foreground">
              {getEventTypeLabel(event.eventType)}
            </p>
          </div>
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar size={12} />
            <span>{formatDate(event.startDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={12} />
            <span>
              {formatTime(event.startDate)} - {formatTime(event.endDate)}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin size={12} />
              <span className="truncate">{event.location}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar size={20} />
            Todos tus Eventos
          </DialogTitle>
          <DialogDescription>
            Gestiona y visualiza todos tus eventos programados
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="proximos"
          className="flex-1 overflow-hidden flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="proximos">
              Próximos ({events.length})
            </TabsTrigger>
            <TabsTrigger value="programados">
              Programados ({programados.length})
            </TabsTrigger>
            <TabsTrigger value="completados">
              Completados ({completados.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="proximos" className="mt-0">
              {events.length > 0 ? (
                <div className="space-y-2">
                  {events.map((event) => (
                    <EventItem key={event._id} event={event} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Calendar size={48} className="text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No hay eventos próximos
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="programados" className="mt-0">
              {programados.length > 0 ? (
                <div className="space-y-2">
                  {programados.map((event) => (
                    <EventItem key={event._id} event={event} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Calendar size={48} className="text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No hay eventos programados
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="completados" className="mt-0">
              {completados.length > 0 ? (
                <div className="space-y-2">
                  {completados.map((event) => (
                    <EventItem key={event._id} event={event} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Calendar size={48} className="text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No hay eventos completados
                  </p>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
