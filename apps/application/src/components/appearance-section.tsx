import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface GeneralSectionProps {
  preferences: any;
  onUpdate: (key: string, value: any) => void;
}

export function GeneralSection({ preferences, onUpdate }: GeneralSectionProps) {
  return (
    <section id="general" className="scroll-mt-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-balance">Configuración Regional</CardTitle>
          <CardDescription className="text-pretty">Configura tu idioma y zona horaria (solo visualización)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="language" className="text-sm font-medium">
              Idioma
            </Label>
            <Select value={preferences.language} onValueChange={(value) => onUpdate("language", value)}>
              <SelectTrigger id="language" className="w-full sm:w-[280px]">
                <SelectValue placeholder="Seleccionar idioma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es-AR">Español (Argentina)</SelectItem>
                <SelectItem value="es-MX">Español (México)</SelectItem>
                <SelectItem value="es-ES">Español (España)</SelectItem>
                <SelectItem value="en-US">English (US)</SelectItem>
                <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label htmlFor="timezone" className="text-sm font-medium">
              Zona Horaria
            </Label>
            <Select value={preferences.timezone} onValueChange={(value) => onUpdate("timezone", value)}>
              <SelectTrigger id="timezone" className="w-full sm:w-[280px]">
                <SelectValue placeholder="Seleccionar zona horaria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Argentina/Buenos_Aires">Buenos Aires (GMT-3)</SelectItem>
                <SelectItem value="America/Mexico_City">Ciudad de México (GMT-6)</SelectItem>
                <SelectItem value="America/Santiago">Santiago (GMT-3)</SelectItem>
                <SelectItem value="America/Sao_Paulo">São Paulo (GMT-3)</SelectItem>
                <SelectItem value="America/Bogota">Bogotá (GMT-5)</SelectItem>
                <SelectItem value="Europe/Madrid">Madrid (GMT+1)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
