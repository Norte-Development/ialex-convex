import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"

interface NotificationsSectionProps {
  preferences: any;
  onUpdate: (key: string, value: any) => void;
}

export function NotificationsSection({ preferences, onUpdate }: NotificationsSectionProps) {
  return (
    <section id="notifications" className="scroll-mt-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-balance">Preferencias de Notificaciones</CardTitle>
          <CardDescription className="text-pretty">Gestiona cómo y cuándo deseas recibir notificaciones</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="emailNotifications" className="text-sm font-medium">
                Notificaciones por Email
              </Label>
              <p className="text-sm text-muted-foreground text-pretty">
                Recibe actualizaciones importantes por correo electrónico
              </p>
            </div>
            <Switch 
              id="emailNotifications" 
              checked={preferences.emailNotifications}
              onCheckedChange={(value) => onUpdate("emailNotifications", value)}
            />
          </div>

          <Separator />

          <div className="space-y-1 mb-4">
            <h4 className="text-sm font-medium">Notificar sobre:</h4>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="caseUpdates" className="text-sm font-medium">
                Actualizaciones de Casos
              </Label>
              <p className="text-sm text-muted-foreground text-pretty">
                Cambios en el estado de tus casos
              </p>
            </div>
            <Switch 
              id="caseUpdates" 
              checked={preferences.caseUpdates}
              onCheckedChange={(value) => onUpdate("caseUpdates", value)}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="documentProcessing" className="text-sm font-medium">
                Procesamiento de Documentos
              </Label>
              <p className="text-sm text-muted-foreground text-pretty">
                Estado del procesamiento de documentos cargados
              </p>
            </div>
            <Switch 
              id="documentProcessing" 
              checked={preferences.documentProcessing}
              onCheckedChange={(value) => onUpdate("documentProcessing", value)}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="teamInvitations" className="text-sm font-medium">
                Invitaciones a Equipos
              </Label>
              <p className="text-sm text-muted-foreground text-pretty">
                Invitaciones para unirte a equipos
              </p>
            </div>
            <Switch 
              id="teamInvitations" 
              checked={preferences.teamInvitations}
              onCheckedChange={(value) => onUpdate("teamInvitations", value)}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="agentResponses" className="text-sm font-medium">
                Respuestas del Agente
              </Label>
              <p className="text-sm text-muted-foreground text-pretty">
                Cuando el agente complete una tarea asignada
              </p>
            </div>
            <Switch 
              id="agentResponses" 
              checked={preferences.agentResponses}
              onCheckedChange={(value) => onUpdate("agentResponses", value)}
            />
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
