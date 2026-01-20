import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface GeneralSectionProps {
  preferences: any;
  profileFields: {
    workLocation?: string;
    specializations?: string[];
  };
  onUpdate: (key: string, value: any) => void;
  onUpdateProfile: (key: string, value: any) => void;
}

export function GeneralSection({
  preferences,
  profileFields,
  onUpdate,
  onUpdateProfile,
}: GeneralSectionProps) {
  return (
    <section id="general" className="scroll-mt-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-balance">Configuración Regional</CardTitle>
          <CardDescription className="text-pretty">
            Configura tu idioma, zona horaria y ubicación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="timezone" className="text-sm font-medium">
              Zona Horaria
            </Label>
            <Select
              value={preferences.timezone}
              onValueChange={(value) => onUpdate("timezone", value)}
            >
              <SelectTrigger id="timezone" className="w-full sm:w-[280px]">
                <SelectValue placeholder="Seleccionar zona horaria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Argentina/Buenos_Aires">
                  Buenos Aires (GMT-3)
                </SelectItem>
                <SelectItem value="America/Mexico_City">
                  Ciudad de México (GMT-6)
                </SelectItem>
                <SelectItem value="America/Santiago">
                  Santiago (GMT-3)
                </SelectItem>
                <SelectItem value="America/Sao_Paulo">
                  São Paulo (GMT-3)
                </SelectItem>
                <SelectItem value="America/Bogota">Bogotá (GMT-5)</SelectItem>
                <SelectItem value="Europe/Madrid">Madrid (GMT+1)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label htmlFor="workLocation" className="text-sm font-medium">
              Ubicación
            </Label>
            <Input
              id="workLocation"
              type="text"
              value={profileFields.workLocation || ""}
              onChange={(e) => onUpdateProfile("workLocation", e.target.value)}
              className="w-full sm:w-[280px]"
              placeholder="Ej: Buenos Aires, Argentina"
            />
            <p className="text-xs text-muted-foreground">
              Tu ubicación de trabajo actual
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
