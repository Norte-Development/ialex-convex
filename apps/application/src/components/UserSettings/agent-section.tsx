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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { useState } from "react";

interface AgentSectionProps {
  preferences: any;
  profileFields: {
    workLocation?: string;
    specializations?: string[];
  };
  onUpdate: (key: string, value: any) => void;
  onUpdateProfile: (key: string, value: any) => void;
}

export function AgentSection({
  preferences,
  profileFields,
  onUpdate,
  onUpdateProfile,
}: AgentSectionProps) {
  const [newSiteUrl, setNewSiteUrl] = useState("");

  const legalSpecializations = [
    "Derecho Civil",
    "Derecho Penal",
    "Derecho Mercantil",
    "Derecho Laboral",
    "Derecho de Familia",
    "Derecho Tributario",
    "Derecho Administrativo",
    "Derecho Constitucional",
    "Derecho Internacional",
    "Propiedad Intelectual",
    "Derecho Ambiental",
    "Derecho de la Salud",
  ];

  const handleSpecializationToggle = (specialization: string) => {
    const currentSpecializations = profileFields?.specializations || [];
    const updated = currentSpecializations.includes(specialization)
      ? currentSpecializations.filter((s: string) => s !== specialization)
      : [...currentSpecializations, specialization];

    onUpdateProfile("specializations", updated);
  };

  const doctrineSearchSites = preferences?.doctrineSearchSites || [];

  const handleAddSite = () => {
    if (!newSiteUrl.trim()) return;

    // Basic URL validation
    try {
      const url = new URL(newSiteUrl.trim());
      const urlString = url.toString();

      // Check if site already exists
      if (doctrineSearchSites.includes(urlString)) {
        return;
      }

      // Add the site
      const updated = [...doctrineSearchSites, urlString];
      onUpdate("doctrineSearchSites", updated);
      setNewSiteUrl("");
    } catch (error) {
      // Invalid URL, don't add
      return;
    }
  };

  const handleRemoveSite = (siteToRemove: string) => {
    const updated = doctrineSearchSites.filter(
      (site: string) => site !== siteToRemove,
    );
    onUpdate("doctrineSearchSites", updated);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSite();
    }
  };

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
            <Label className="text-sm font-medium">Especialización Legal</Label>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 w-full max-w-[550px]">
              {legalSpecializations.map((specialization) => (
                <label
                  key={specialization}
                  className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded-md cursor-pointer transition-colors ${
                    (profileFields?.specializations || []).includes(
                      specialization,
                    )
                      ? "bg-[#E8F0FE] border-l-2 border-l-blue-600"
                      : "bg-white hover:bg-[#E8F0FE] border border-gray-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={(profileFields?.specializations || []).includes(
                      specialization,
                    )}
                    onChange={() => handleSpecializationToggle(specialization)}
                    className="sr-only"
                  />
                  {/* Radio button indicator */}
                  <div className="flex items-center justify-center w-4 h-4 relative shrink-0">
                    <div className="w-4 h-4 rounded-full border border-gray-200" />
                    {(profileFields?.specializations || []).includes(
                      specialization,
                    ) && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-left leading-tight">
                    {specialization}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              El agente priorizará contenido relacionado con tus
              especializaciones
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

          <Separator />

          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">
                Sitios de Búsqueda de Doctrina
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Sitios web donde el agente buscará doctrina legal. El agente
                buscará en estos sitios cuando necesite información doctrinal.
              </p>
            </div>

            {/* Display current sites */}
            {doctrineSearchSites.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {doctrineSearchSites.map((site: string) => (
                  <Badge
                    key={site}
                    variant="outline"
                    className="flex items-center gap-1.5 pr-1 py-1.5"
                  >
                    <span className="text-xs max-w-[300px] truncate">
                      {site}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSite(site)}
                      className="ml-1 rounded-full hover:bg-gray-200 p-0.5 transition-colors"
                      aria-label={`Eliminar ${site}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Add new site */}
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://ejemplo.com"
                value={newSiteUrl}
                onChange={(e) => setNewSiteUrl(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleAddSite}
                size="sm"
                variant="outline"
                disabled={!newSiteUrl.trim()}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar
              </Button>
            </div>
            {doctrineSearchSites.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No hay sitios configurados. Agrega al menos uno para habilitar
                la búsqueda de doctrina.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
