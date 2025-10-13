import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface PrivacySectionProps {
  preferences: any;
  onUpdate: (key: string, value: any) => void;
}

export function PrivacySection({ preferences, onUpdate }: PrivacySectionProps) {
  return (
    <section id="privacy" className="scroll-mt-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-balance">Privacidad y Seguridad</CardTitle>
          <CardDescription className="text-pretty">Gestiona la seguridad y privacidad de tu cuenta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="sessionTimeout" className="text-sm font-medium">
              Tiempo de Inactividad
            </Label>
            <Select 
              value={preferences.sessionTimeout?.toString()} 
              onValueChange={(value) => onUpdate("sessionTimeout", parseInt(value))}
            >
              <SelectTrigger id="sessionTimeout" className="w-full sm:w-[280px]">
                <SelectValue placeholder="Seleccionar tiempo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutos</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="60">1 hora</SelectItem>
                <SelectItem value="120">2 horas</SelectItem>
                <SelectItem value="0">Nunca</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Tiempo de inactividad antes de cerrar sesión automáticamente
            </p>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="activityLogVisible" className="text-sm font-medium">
                Registro de Actividad Visible
              </Label>
              <p className="text-sm text-muted-foreground text-pretty">
                Mostrar tu registro de actividad en el perfil
              </p>
            </div>
            <Switch 
              id="activityLogVisible" 
              checked={preferences.activityLogVisible}
              onCheckedChange={(value) => onUpdate("activityLogVisible", value)}
            />
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
