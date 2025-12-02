import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Scale, AlertTriangle, CheckCircle2 } from "lucide-react";

export function PjnAccountSection() {
  const accountStatus = useQuery(api.pjn.accounts.getAccountStatus, {});
  // Cast through any because the generated Convex API types may not yet include
  // the new connectAccount action until `npx convex dev` is run.
  const connectAccount = useAction(
    (api.pjn.accounts as any).connectAccount,
  ) as (args: { username: string; password: string }) => Promise<{
    status: "OK" | "AUTH_FAILED" | "ERROR";
    message?: string;
  }>;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConnect = async () => {
    if (!username || !password) {
      toast.error("Ingresá usuario y contraseña de PJN");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await connectAccount({ username, password });

      if (result.status === "OK") {
        toast.success("Cuenta de PJN conectada correctamente");
        setPassword("");
      } else if (result.status === "AUTH_FAILED") {
        toast.error(result.message || "Credenciales de PJN inválidas");
      } else {
        toast.error(result.message || "Error al conectar con PJN");
      }
    } catch (error) {
      console.error("Error connecting PJN account:", error);
      toast.error("Error inesperado al conectar con PJN");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isConnected = Boolean(accountStatus?.sessionValid && !accountStatus?.needsReauth);

  return (
    <section id="pjn-account" className="scroll-mt-8 max-w-3xl mx-auto">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-slate-700" />
                <CardTitle>Cuenta PJN</CardTitle>
                {isConnected && (
                  <Badge variant="outline" className="border-emerald-200 text-emerald-800 bg-emerald-50">
                    Conectada
                  </Badge>
                )}
              </div>
              <CardDescription>
                Conectá tu cuenta del Portal del Poder Judicial para sincronizar notificaciones y documentos.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {accountStatus && (
            <div className="space-y-2">
              {accountStatus.needsReauth && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Necesitamos que vuelvas a iniciar sesión en PJN. Actualizá tus credenciales abajo.
                  </AlertDescription>
                </Alert>
              )}
              {!accountStatus.needsReauth && accountStatus.sessionValid && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription>
                    Cuenta conectada como <span className="font-mono">{accountStatus.username}</span>.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pjn-username">Usuario PJN</Label>
              <Input
                id="pjn-username"
                placeholder="Usuario del portal PJN"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pjn-password">Contraseña PJN</Label>
              <Input
                id="pjn-password"
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleConnect} disabled={isSubmitting}>
              {isSubmitting ? "Conectando..." : isConnected ? "Actualizar credenciales" : "Conectar cuenta"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}


