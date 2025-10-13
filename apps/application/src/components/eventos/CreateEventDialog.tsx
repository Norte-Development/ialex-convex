import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Case } from "types/cases";

interface CreateEventDialogProps {
  caseId?: string;
  teamId?: string;
  showCaseSelector?: boolean; // Nueva prop para mostrar selector de casos
  showTeamSelector?: boolean; // Nueva prop para mostrar selector de equipos
}

export default function CreateEventDialog({
  caseId: propCaseId,
  teamId: propTeamId,
  showCaseSelector = false,
  showTeamSelector = false,
}: CreateEventDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<string>("reunion_cliente");
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>(
    propCaseId,
  );
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(
    propTeamId,
  );
  const [eventDate, setEventDate] = useState(""); // Fecha única
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [multiDay, setMultiDay] = useState(false); // Evento de varios días
  const [endDate, setEndDate] = useState(""); // Solo si multiDay = true
  const [location, setLocation] = useState("");
  const [isVirtual, setIsVirtual] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [notes, setNotes] = useState("");

  // Queries para selectores
  const cases = useQuery(
    api.functions.cases.getCases,
    showCaseSelector ? {} : "skip",
  );
  const teams = useQuery(
    api.functions.teams.getTeams,
    showTeamSelector ? {} : "skip",
  );

  const createEvent = useMutation(api.functions.events.createEvent);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Combinar fecha y hora
      let startDateTime: Date;
      let endDateTime: Date;

      if (multiDay) {
        // Evento de varios días
        startDateTime = new Date(`${eventDate}T${startTime || "00:00"}`);
        endDateTime = new Date(`${endDate}T${endTime || "23:59"}`);
      } else {
        // Evento de un solo día
        startDateTime = new Date(`${eventDate}T${startTime || "00:00"}`);
        endDateTime = new Date(`${eventDate}T${endTime || "23:59"}`);
      }

      if (endDateTime <= startDateTime) {
        toast.error("La hora de fin debe ser posterior a la de inicio");
        setIsLoading(false);
        return;
      }

      await createEvent({
        title,
        description: description || undefined,
        caseId: selectedCaseId as any,
        teamId: selectedTeamId as any,
        eventType: eventType as any,
        startDate: startDateTime.getTime(),
        endDate: endDateTime.getTime(),
        allDay,
        location: location || undefined,
        isVirtual,
        meetingUrl: meetingUrl || undefined,
        reminderMinutes: [15, 60, 1440], // 15min, 1h, 1 día antes
        notes: notes || undefined,
      });

      toast.success("Evento creado exitosamente");

      // Reset form
      setTitle("");
      setDescription("");
      setEventType("reunion_cliente");
      setEventDate("");
      setStartTime("");
      setEndTime("");
      setEndDate("");
      setAllDay(false);
      setMultiDay(false);
      setLocation("");
      setIsVirtual(false);
      setMeetingUrl("");
      setNotes("");
      setOpen(false);
    } catch (error) {
      console.error("Error creating event:", error);
      toast.error("No se pudo crear el evento");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} className="mr-2" />
          Crear Evento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar size={20} />
            Crear Nuevo Evento
          </DialogTitle>
          <DialogDescription>
            Crea un evento para tu calendario personal, de caso o de equipo
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Título <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Audiencia Caso López"
              required
            />
          </div>

          {/* Selector de Caso (si showCaseSelector = true) */}
          {showCaseSelector && (
            <div className="space-y-2">
              <Label htmlFor="caseId">Vincular a Caso (Opcional)</Label>
              <Select
                value={selectedCaseId || "none"}
                onValueChange={(value) =>
                  setSelectedCaseId(value === "none" ? undefined : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar caso..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin vincular</SelectItem>
                  {cases?.map((caseItem: Case) => (
                    <SelectItem key={caseItem._id} value={caseItem._id}>
                      {caseItem.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Selector de Equipo (si showTeamSelector = true) */}
          {showTeamSelector && (
            <div className="space-y-2">
              <Label htmlFor="teamId">Vincular a Equipo (Opcional)</Label>
              <Select
                value={selectedTeamId || "none"}
                onValueChange={(value) =>
                  setSelectedTeamId(value === "none" ? undefined : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar equipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin vincular</SelectItem>
                  {teams?.map((team) => (
                    <SelectItem key={team._id} value={team._id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tipo de evento */}
          <div className="space-y-2">
            <Label htmlFor="eventType">
              Tipo de Evento <span className="text-red-500">*</span>
            </Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="audiencia">🏛️ Audiencia</SelectItem>
                <SelectItem value="plazo">⏰ Plazo Legal</SelectItem>
                <SelectItem value="reunion_cliente">
                  👥 Reunión con Cliente
                </SelectItem>
                <SelectItem value="presentacion">
                  📄 Presentación de Documentos
                </SelectItem>
                <SelectItem value="reunion_equipo">
                  👨‍💼 Reunión de Equipo
                </SelectItem>
                <SelectItem value="personal">🙋 Personal</SelectItem>
                <SelectItem value="otro">📌 Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fecha del evento */}
          <div className="space-y-2">
            <Label htmlFor="eventDate">
              Fecha del Evento <span className="text-red-500">*</span>
            </Label>
            <Input
              id="eventDate"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
          </div>

          {/* Horarios */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">
                Hora de Inicio <span className="text-red-500">*</span>
              </Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={allDay}
                required={!allDay}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">
                Hora de Fin <span className="text-red-500">*</span>
              </Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={allDay}
                required={!allDay}
              />
            </div>
          </div>

          {/* Opciones de duración */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allDay"
                checked={allDay}
                onCheckedChange={(checked) => {
                  setAllDay(checked as boolean);
                  if (checked) setMultiDay(false);
                }}
              />
              <Label htmlFor="allDay" className="cursor-pointer text-sm">
                Evento de todo el día
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="multiDay"
                checked={multiDay}
                onCheckedChange={(checked) => {
                  setMultiDay(checked as boolean);
                  if (checked) setAllDay(false);
                }}
              />
              <Label htmlFor="multiDay" className="cursor-pointer text-sm">
                Evento de varios días
              </Label>
            </div>
          </div>

          {/* Fecha de fin (solo si multiDay) */}
          {multiDay && (
            <div className="space-y-2">
              <Label htmlFor="endDate">
                Fecha de Fin <span className="text-red-500">*</span>
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                min={eventDate}
              />
            </div>
          )}

          {/* Ubicación */}
          <div className="space-y-2">
            <Label htmlFor="location">Ubicación</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej: Juzgado Civil N°5, Sala 3"
            />
          </div>

          {/* Virtual */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isVirtual"
              checked={isVirtual}
              onCheckedChange={(checked) => setIsVirtual(checked as boolean)}
            />
            <Label htmlFor="isVirtual" className="cursor-pointer">
              Evento virtual
            </Label>
          </div>

          {/* URL de reunión */}
          {isVirtual && (
            <div className="space-y-2">
              <Label htmlFor="meetingUrl">URL de Reunión</Label>
              <Input
                id="meetingUrl"
                type="url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://meet.google.com/..."
              />
            </div>
          )}

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles adicionales del evento..."
              rows={3}
            />
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas..."
              rows={2}
            />
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creando..." : "Crear Evento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
