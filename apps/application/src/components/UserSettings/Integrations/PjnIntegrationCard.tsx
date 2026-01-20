import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function PjnIntegrationCard() {
  const accountStatus = useQuery(api.pjn.accounts.getAccountStatus, {});
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

  const isConnected = Boolean(accountStatus?.sessionValid && !accountStatus?.needsReauth)

  return (
    <>
      {accountStatus && (
        <div className="space-y-2 mb-4">
          {accountStatus.needsReauth && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Necesitamos que vuelvas a iniciar sesión en PJN. Actualizá tus credenciales abajo.
              </AlertDescription>
            </Alert>
          )}
          {!accountStatus.needsReauth && accountStatus.sessionValid && (
            <Alert className="border-emerald-500/30 bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <AlertDescription className="text-emerald-800 dark:text-emerald-300">
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

      <div className="flex justify-end mt-4">
        <Button onClick={handleConnect} disabled={isSubmitting}>
          {isSubmitting ? "Conectando..." : isConnected ? "Actualizar credenciales" : "Conectar cuenta"}
        </Button>
      </div>
    </>
  )
}

