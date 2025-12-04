import { Scale, Database, FileText } from "lucide-react"
import { IntegrationCard } from "./IntegrationCard"
import { PjnIntegrationCard } from "./PjnIntegrationCard"

export function IntegrationsSection() {
  return (
    <section id="integrations" className="space-y-6 max-w-4xl mx-auto animate-in fade-in-50">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Integraciones</h2>
        <p className="text-muted-foreground">
          Conectá iAlex con fuentes externas para sincronizar datos y automatizar tareas.
        </p>
      </div>

      <div className="space-y-3">
        <IntegrationCard
          id="pjn"
          icon={Scale}
          title="Cuenta PJN"
          description="Portal del Poder Judicial para sincronizar notificaciones y documentos"
          status="connected"
          defaultOpen={true}
        >
          <PjnIntegrationCard />
        </IntegrationCard>
      </div>
    </section>
  )
}
