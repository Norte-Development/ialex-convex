import { Scale, Database, FileText } from "lucide-react"
import { useQuery } from "convex/react"
import { api } from "../../../../convex/_generated/api"
import { IntegrationCard } from "./IntegrationCard"
import { PjnIntegrationCard } from "./PjnIntegrationCard"

export function IntegrationsSection() {
  const accountStatus = useQuery(api.pjn.accounts.getAccountStatus, {});

  // Determine connection status based on account status
  const getPjnStatus = (): "connected" | "disconnected" | "error" => {
    if (!accountStatus) {
      return "disconnected";
    }
    
    // If needs reauth, show as error
    if (accountStatus.needsReauth) {
      return "error";
    }
    
    // If session is valid and doesn't need reauth, show as connected
    if (accountStatus.sessionValid && !accountStatus.needsReauth) {
      return "connected";
    }
    
    // Default to disconnected
    return "disconnected";
  };

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
          status={getPjnStatus()}
          defaultOpen={true}
        >
          <PjnIntegrationCard />
        </IntegrationCard>
      </div>
    </section>
  )
}
