import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import CreateEventDialog from "@/components/eventos/CreateEventDialog";
import EventsContainer from "@/components/eventos/EventsContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EventosPage() {
  const upcomingEvents = useQuery(api.functions.events.getUpcomingEvents, {
    days: 30,
    paginationOpts: { numItems: 100, cursor: null }
  });
  const allEvents = useQuery(api.functions.events.getMyEvents, {
    paginationOpts: { numItems: 100, cursor: null }
  });

  const allEventsData = allEvents?.page || [];
  const events = upcomingEvents?.page || [];

  // Filtrar eventos por estado (todos, sin filtro de fecha)
  const programados = allEventsData.filter((e: any) => e.status === "programado");
  const completados = allEventsData.filter((e: any) => e.status === "completado");
  const cancelados = allEventsData.filter((e: any) => e.status === "cancelado");

  return (
    <div className=" mx-auto flex flex-col justify-center items-center min-h-full w-full pt-20  px-4 ">
      <div className="flex justify-between w-full items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Calendario de Eventos</h1>
          <p className="text-muted-foreground">
            Gestiona tus audiencias, plazos y reuniones
          </p>
        </div>
        <CreateEventDialog
          showReminderSelector
          showCaseSelector
          showTeamSelector
        />
      </div>

      <Tabs defaultValue="programados" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4 h-auto">
          <TabsTrigger
            value="proximos"
            className="text-xs sm:text-sm px-2 py-2"
            title="Eventos programados en los próximos 30 días"
          >
            Próximos ({events.length})
          </TabsTrigger>
          <TabsTrigger
            value="programados"
            className="text-xs sm:text-sm px-2 py-2"
            title="Todos los eventos programados (sin límite de fecha)"
          >
            Programados ({programados.length})
          </TabsTrigger>
          <TabsTrigger
            value="completados"
            className="text-xs sm:text-sm px-2 py-2"
            title="Eventos ya realizados"
          >
            Completados ({completados.length})
          </TabsTrigger>
          <TabsTrigger
            value="cancelados"
            className="text-xs sm:text-sm px-2 py-2"
            title="Eventos cancelados"
          >
            Cancelados ({cancelados.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proximos" className="mt-6">
          <EventsContainer eventType="upcoming" pageSize={20} />
        </TabsContent>

        <TabsContent value="programados" className="mt-6">
          <EventsContainer eventType="programados" pageSize={20} />
        </TabsContent>

        <TabsContent value="completados" className="mt-6">
          <EventsContainer eventType="completados" pageSize={20} />
        </TabsContent>

        <TabsContent value="cancelados" className="mt-6">
          <EventsContainer eventType="cancelados" pageSize={20} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
