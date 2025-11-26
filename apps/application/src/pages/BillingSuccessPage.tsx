import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Sparkles, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function BillingSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const plan = searchParams.get("plan") || "premium";

  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);
  }, []);

  const planNames: Record<string, { title: string; description: string }> = {
    premium_individual: {
      title: "Plan Premium Individual",
      description: "Acceso completo a todas las funciones de iAlex para uso personal",
    },
    premium_team: {
      title: "Plan Premium Team",
      description: "Colaboración ilimitada con tu equipo legal",
    },
    ai_credits: {
      title: "Créditos de IA",
      description: "Créditos adicionales para usar funciones de inteligencia artificial",
    },
  };

  const planInfo = planNames[plan] || {
    title: "Plan Premium",
    description: "Gracias por tu compra",
  };

  const isPremiumTeam = plan === "premium_team";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-blue-50 p-4 w-full">
      <Card className="max-w-2xl w-full shadow-xl">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold">
              ¡Gracias por tu compra!
            </CardTitle>
            <CardDescription className="text-lg">
              Tu suscripción se ha activado correctamente
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-6 space-y-2">
            <div className="flex items-center gap-2">
              {isPremiumTeam ? (
                <Users className="w-5 h-5 text-blue-600" />
              ) : (
                <Sparkles className="w-5 h-5 text-purple-600" />
              )}
              <h3 className="font-semibold text-lg">{planInfo.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {planInfo.description}
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">
              ¿Qué sigue?
            </h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm">
                  Tu suscripción está activa y lista para usar
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm">
                  Puedes gestionar tu facturación desde Preferencias
                </span>
              </li>
              {isPremiumTeam && (
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">
                    Ahora puedes crear equipos e invitar a colaboradores
                  </span>
                </li>
              )}
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={() => navigate("/")}
              className="flex-1"
              size="lg"
            >
              Ir al inicio
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            {isPremiumTeam && (
              <Button
                onClick={() => navigate("/equipo")}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                <Users className="w-4 h-4 mr-2" />
                Crear equipo
              </Button>
            )}
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              Recibirás un correo de confirmación con los detalles de tu compra
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

