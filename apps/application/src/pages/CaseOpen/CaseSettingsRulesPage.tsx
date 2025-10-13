import CaseLayout from "@/components/Cases/CaseLayout";
import { CaseAgentRules } from "@/components/CaseSettings/AgentRules";

export default function CaseSettingsRulesPage() {
  return (
    <CaseLayout>
      <div className="p-4 space-y-4">
        <h2 className="text-xl font-semibold">Reglas del Agente</h2>
        <CaseAgentRules />
      </div>
    </CaseLayout>
  );
}
