import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface AgentSectionProps {
  preferences: any;
  user: any; // Usuario completo para acceder a specializations y workLocation
  onUpdate: (key: string, value: any) => void;
  onUpdateProfile: (key: string, value: any) => void; // Nueva función para actualizar el perfil
}

export function AgentSection({
  preferences,
  user,
  onUpdate,
  onUpdateProfile,
}: AgentSectionProps) {
  return (
    <section id="agent" className="scroll-mt-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-balance">
            Preferencias del Agente IA
          </CardTitle>
          <CardDescription className="text-pretty">
            Personaliza cómo el agente de IA interactúa contigo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="specialization" className="text-sm font-medium">
              Especialización Legal
            </Label>
            <Select
              value={
                (user?.specializations && user.specializations[0]) || "general"
              }
              onValueChange={(value) =>
                onUpdateProfile("specializations", [value])
              }
            >
              <SelectTrigger
                id="specialization"
                className="w-full sm:w-[280px]"
              >
                <SelectValue placeholder="Seleccionar especialización" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">Derecho General</SelectItem>
                <SelectItem value="civil">Derecho Civil</SelectItem>
                <SelectItem value="comercial">Derecho Comercial</SelectItem>
                <SelectItem value="penal">Derecho Penal</SelectItem>
                <SelectItem value="laboral">Derecho Laboral</SelectItem>
                <SelectItem value="tributario">Derecho Tributario</SelectItem>
                <SelectItem value="familia">Derecho de Familia</SelectItem>
                <SelectItem value="administrativo">
                  Derecho Administrativo
                </SelectItem>
                <SelectItem value="constitucional">
                  Derecho Constitucional
                </SelectItem>
                <SelectItem value="ambiental">Derecho Ambiental</SelectItem>
                <SelectItem value="internacional">
                  Derecho Internacional
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              El agente priorizará contenido relacionado con tu especialización
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label htmlFor="workLocation" className="text-sm font-medium">
              Provincia / Jurisdicción
            </Label>
            <Select
              value={user?.workLocation || "Nacional"}
              onValueChange={(value) => onUpdateProfile("workLocation", value)}
            >
              <SelectTrigger id="workLocation" className="w-full sm:w-[280px]">
                <SelectValue placeholder="Seleccionar provincia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Nacional">Nacional</SelectItem>
                <SelectItem value="Ciudad Autónoma de Buenos Aires">
                  Ciudad Autónoma de Buenos Aires
                </SelectItem>
                <SelectItem value="Buenos Aires">Buenos Aires</SelectItem>
                <SelectItem value="Catamarca">Catamarca</SelectItem>
                <SelectItem value="Chaco">Chaco</SelectItem>
                <SelectItem value="Chubut">Chubut</SelectItem>
                <SelectItem value="Córdoba">Córdoba</SelectItem>
                <SelectItem value="Corrientes">Corrientes</SelectItem>
                <SelectItem value="Entre Ríos">Entre Ríos</SelectItem>
                <SelectItem value="Formosa">Formosa</SelectItem>
                <SelectItem value="Jujuy">Jujuy</SelectItem>
                <SelectItem value="La Pampa">La Pampa</SelectItem>
                <SelectItem value="La Rioja">La Rioja</SelectItem>
                <SelectItem value="Mendoza">Mendoza</SelectItem>
                <SelectItem value="Misiones">Misiones</SelectItem>
                <SelectItem value="Neuquén">Neuquén</SelectItem>
                <SelectItem value="Río Negro">Río Negro</SelectItem>
                <SelectItem value="Salta">Salta</SelectItem>
                <SelectItem value="San Juan">San Juan</SelectItem>
                <SelectItem value="San Luis">San Luis</SelectItem>
                <SelectItem value="Santa Cruz">Santa Cruz</SelectItem>
                <SelectItem value="Santa Fe">Santa Fe</SelectItem>
                <SelectItem value="Santiago del Estero">
                  Santiago del Estero
                </SelectItem>
                <SelectItem value="Tierra del Fuego">
                  Tierra del Fuego
                </SelectItem>
                <SelectItem value="Tucumán">Tucumán</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Jurisprudencia provincial que utilizarás con más frecuencia
            </p>
          </div>

          <Separator />
          <div className="space-y-3">
            <Label htmlFor="agentResponseStyle" className="text-sm font-medium">
              Estilo de Respuesta
            </Label>
            <Select
              value={preferences.agentResponseStyle}
              onValueChange={(value) => onUpdate("agentResponseStyle", value)}
            >
              <SelectTrigger
                id="agentResponseStyle"
                className="w-full sm:w-[280px]"
              >
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
            <Label
              htmlFor="defaultJurisdiction"
              className="text-sm font-medium"
            >
              Jurisdicción por Defecto
            </Label>
            {/* <Select 
              value={preferences.defaultJurisdiction} 
              onValueChange={(value) => onUpdate("defaultJurisdiction", value)}
            > */}
            {/* <SelectTrigger id="defaultJurisdiction" className="w-full sm:w-[280px]">
                <SelectValue placeholder="Seleccionar jurisdicción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="argentina">Argentina</SelectItem>
                <SelectItem value="paraguay">Paraguay</SelectItem>
              </SelectContent>
            </Select> */}
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
              <SelectTrigger
                id="citationFormat"
                className="w-full sm:w-[280px]"
              >
                <SelectValue placeholder="Seleccionar formato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apa">APA</SelectItem>
                <SelectItem value="bluebook">Bluebook</SelectItem>
                <SelectItem value="chicago">Chicago</SelectItem>
                <SelectItem value="legal-arg">
                  Estilo Legal Argentino
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Formato preferido para referencias legales
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 pt-3">
            <div className="space-y-0.5 flex-1">
              <Label
                htmlFor="autoIncludeContext"
                className="text-sm font-medium"
              >
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
  );
}
