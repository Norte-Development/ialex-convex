import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface AgentSectionProps {
  preferences: any;
  onUpdate: (key: string, value: any) => void;
}

export function AgentSection({ preferences, onUpdate }: AgentSectionProps) {
  return (
    <section id="agent" className="scroll-mt-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-balance">Preferencias del Agente IA</CardTitle>
          <CardDescription className="text-pretty">Personaliza cómo el agente de IA interactúa contigo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="agentResponseStyle" className="text-sm font-medium">
              Estilo de Respuesta
            </Label>
            <Select 
              value={preferences.agentResponseStyle} 
              onValueChange={(value) => onUpdate("agentResponseStyle", value)}
            >
              <SelectTrigger id="agentResponseStyle" className="w-full sm:w-[280px]">
                <SelectValue placeholder="Seleccionar estilo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="informal">Informal</SelectItem>
                <SelectItem value="conciso">Conciso</SelectItem>
                <SelectItem value="detallado">Detallado</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Cómo el agente estructura sus respuestas
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="defaultJurisdiction" className="text-sm font-medium">
              Jurisdicción por Defecto
            </Label>
            <Select 
              value={preferences.defaultJurisdiction} 
              onValueChange={(value) => onUpdate("defaultJurisdiction", value)}
            >
              <SelectTrigger id="defaultJurisdiction" className="w-full sm:w-[280px]">
                <SelectValue placeholder="Seleccionar jurisdicción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="argentina">Argentina</SelectItem>
                <SelectItem value="paraguay">Paraguay</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Legislación aplicable por defecto
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="citationFormat" className="text-sm font-medium">
              Formato de Citas
            </Label>
            <Select 
              value={preferences.citationFormat} 
              onValueChange={(value) => onUpdate("citationFormat", value)}
            >
              <SelectTrigger id="citationFormat" className="w-full sm:w-[280px]">
                <SelectValue placeholder="Seleccionar formato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apa">APA</SelectItem>
                <SelectItem value="bluebook">Bluebook</SelectItem>
                <SelectItem value="chicago">Chicago</SelectItem>
                <SelectItem value="legal-arg">Estilo Legal Argentino</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Formato preferido para referencias legales
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 pt-3">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="autoIncludeContext" className="text-sm font-medium">
                Incluir Contexto Automáticamente
              </Label>
              <p className="text-sm text-muted-foreground text-pretty">
                El agente incluirá automáticamente información del caso actual
              </p>
            </div>
            <Switch 
              id="autoIncludeContext" 
              checked={preferences.autoIncludeContext}
              onCheckedChange={(value) => onUpdate("autoIncludeContext", value)}
            />
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

