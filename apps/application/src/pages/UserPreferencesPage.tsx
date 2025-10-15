import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AgentRulesSection } from "@/components/UserSettings/AgentRules";
import { PreferencesNav } from "@/components/preferences-nav";
import { GeneralSection } from "@/components/appearance-section";
import { NotificationsSection } from "@/components/notifications-section";
import { AgentSection } from "@/components/agent-section";
import { PrivacySection } from "@/components/privacy-section";
import { BillingSection } from "@/components/Billing";
import { Loader2 } from "lucide-react";

// Default preferences
const DEFAULT_PREFERENCES = {
  language: "es-AR",
  timezone: "America/Argentina/Buenos_Aires",
  emailNotifications: true,
  caseUpdates: true,
  documentProcessing: true,
  teamInvitations: true,
  agentResponses: true,
  agentResponseStyle: "formal",
  defaultJurisdiction: "argentina",
  autoIncludeContext: true,
  citationFormat: "apa",
  sessionTimeout: 60,
  activityLogVisible: true,
};

export default function UserPreferencesPage() {
  const currentUser = useQuery(api.functions.users.getCurrentUser, {});
  const updatePreferences = useMutation(api.functions.users.updateUserPreferences);

  // State for all preferences and UI
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [activeSection, setActiveSection] = useState("general");

  // Load preferences from user data
  useEffect(() => {
    if (currentUser?.preferences) {
      setPreferences({
        ...DEFAULT_PREFERENCES,
        ...currentUser.preferences,
      });
    }
  }, [currentUser]);

  // Update a single preference
  const updatePreference = (key: string, value: any) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  // Save preferences
  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      await updatePreferences({ preferences });
      toast.success("Preferencias guardadas exitosamente");
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Error al guardar preferencias");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full h-full pt-20 px-10 min-h-screen bg-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Preferencias</h1>
          <p className="text-sm text-muted-foreground">
            Configura tu experiencia en iAlex
          </p>
        </div>
        <Button onClick={handleSavePreferences} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            "Guardar Cambios"
          )}
        </Button>
      </div>

      {/* Content */}
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Navigation Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <PreferencesNav 
            activeSection={activeSection} 
            onSectionChange={setActiveSection}
          />
        </aside>

        {/* Content Area */}
        <main className="min-w-0 pb-10">
          {activeSection === "general" && (
            <GeneralSection 
              preferences={preferences}
              onUpdate={updatePreference}
            />
          )}

          {activeSection === "notifications" && (
            <NotificationsSection 
              preferences={preferences}
              onUpdate={updatePreference}
            />
          )}

          {activeSection === "agent" && (
            <AgentSection 
              preferences={preferences}
              onUpdate={updatePreference}
            />
          )}

          {activeSection === "billing" && (
            <BillingSection />
          )}

          {activeSection === "privacy" && (
            <PrivacySection 
              preferences={preferences}
              onUpdate={updatePreference}
            />
          )}

          {activeSection === "agentRules" && (
            <div id="agentRules" className="scroll-mt-8">
              <AgentRulesSection />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
