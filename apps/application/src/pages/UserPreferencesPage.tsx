import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import { AgentRulesSection } from "@/components/UserSettings/AgentRules";

export default function UserPreferencesPage() {
  const currentUser = useQuery(api.functions.users.getCurrentUser, {});

  const [language, setLanguage] = useState("es-AR");
  const [timezone, setTimezone] = useState("America/Argentina/Buenos_Aires");
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    if (currentUser?.preferences) {
      setLanguage(currentUser.preferences.language);
      setTimezone(currentUser.preferences.timezone);
      setNotifications(currentUser.preferences.notifications);
    }
  }, [currentUser]);

  // Placeholder for saving preferences when backend is ready
  const handleSavePreferences = () => {
    toast.success("Preferencias guardadas");
  };

  return (
    <div className="px-6 py-6 space-y-6">
      <h1 className="text-2xl font-semibold">Preferencias de Usuario</h1>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="agentRules">Reglas del Agente</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Idioma</Label>
                  <Input
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    placeholder="es-AR"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Zona Horaria</Label>
                  <Input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="America/Argentina/Buenos_Aires"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={notifications}
                    onCheckedChange={setNotifications}
                    id="notifications"
                  />
                  <Label htmlFor="notifications">Notificaciones</Label>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSavePreferences}>Guardar</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agentRules">
          <AgentRulesSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
