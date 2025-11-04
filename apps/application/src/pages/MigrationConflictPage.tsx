/**
 * Migration Conflict Resolution Page
 * 
 * This page allows users to resolve conflicts when they have accounts
 * in both the old (Kinde) and new (Clerk) systems.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2, User, Database } from "lucide-react";

export function MigrationConflictPage() {
  const navigate = useNavigate();
  const [isResolving, setIsResolving] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<"merge" | "alternative" | null>(null);

  // TODO: Implement these queries/mutations in Convex
  // const conflictData = useQuery(api.migrations.getConflictData);
  // const resolveConflict = useMutation(api.migrations.resolveConflict);

  // Mock data for now
  const conflictData = {
    hasConflicts: true,
    email: "user@example.com",
    currentAccountData: {
      casesCount: 5,
      documentsCount: 12,
      clientsCount: 3,
      escritosCount: 8,
    },
    oldAccountData: {
      casesCount: 3,
      documentsCount: 7,
      clientsCount: 2,
      escritosCount: 4,
    },
    alternativeEmail: "user+migrated@example.com",
  };

  const handleResolveConflict = async (strategy: "merge" | "alternative") => {
    setIsResolving(true);
    setSelectedStrategy(strategy);

    try {
      // TODO: Implement actual conflict resolution
      // await resolveConflict({ strategy });
      
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // Navigate to migration consent page after resolution
      navigate("/migration/consent");
    } catch (error) {
      console.error("Failed to resolve conflict:", error);
      setIsResolving(false);
      setSelectedStrategy(null);
    }
  };

  // If no conflicts, redirect to consent page
  if (!conflictData?.hasConflicts) {
    navigate("/migration/consent");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Resolución de Conflicto de Cuenta
          </h1>
          <p className="text-lg text-gray-600">
            Detectamos que ya tienes una cuenta en la nueva plataforma iAlex
          </p>
        </div>

        <Alert className="mb-8 border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <AlertTitle className="text-yellow-900">
            ¡Acción Requerida!
          </AlertTitle>
          <AlertDescription className="text-yellow-800">
            Encontramos que ya tienes una cuenta con el email{" "}
            <strong>{conflictData.email}</strong> en la nueva plataforma.
            Necesitamos decidir cómo manejar tus datos.
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          {/* Option 1: Merge Accounts */}
          <Card
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedStrategy === "merge" ? "border-purple-500 ring-2 ring-purple-200" : ""
            }`}
            onClick={() => !isResolving && setSelectedStrategy("merge")}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Database className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">
                      Opción 1: Fusionar Cuentas (Recomendado)
                    </CardTitle>
                    <CardDescription>
                      Mantener tu cuenta actual y migrar los datos de la cuenta anterior
                    </CardDescription>
                  </div>
                </div>
                {selectedStrategy === "merge" && (
                  <CheckCircle2 className="h-6 w-6 text-purple-600" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Con esta opción, combinaremos todos tus datos de ambas cuentas en una sola.
                  Esto incluye casos, documentos, clientes y escritos.
                </p>

                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">
                      Cuenta Actual (Nueva)
                    </h4>
                    <ul className="text-sm space-y-1 text-gray-600">
                      <li>• {conflictData.currentAccountData.casesCount} casos</li>
                      <li>• {conflictData.currentAccountData.documentsCount} documentos</li>
                      <li>• {conflictData.currentAccountData.clientsCount} clientes</li>
                      <li>• {conflictData.currentAccountData.escritosCount} escritos</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">
                      Cuenta Anterior (Kinde)
                    </h4>
                    <ul className="text-sm space-y-1 text-gray-600">
                      <li>• {conflictData.oldAccountData.casesCount} casos</li>
                      <li>• {conflictData.oldAccountData.documentsCount} documentos</li>
                      <li>• {conflictData.oldAccountData.clientsCount} clientes</li>
                      <li>• {conflictData.oldAccountData.escritosCount} escritos</li>
                    </ul>
                  </div>
                </div>

                <Button
                  onClick={() => handleResolveConflict("merge")}
                  disabled={isResolving}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {isResolving && selectedStrategy === "merge" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Fusionando Cuentas...
                    </>
                  ) : (
                    "Fusionar Cuentas"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Option 2: Create Alternative Account */}
          <Card
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedStrategy === "alternative" ? "border-blue-500 ring-2 ring-blue-200" : ""
            }`}
            onClick={() => !isResolving && setSelectedStrategy("alternative")}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">
                      Opción 2: Crear Cuenta Alternativa
                    </CardTitle>
                    <CardDescription>
                      Crear una nueva cuenta con email modificado
                    </CardDescription>
                  </div>
                </div>
                {selectedStrategy === "alternative" && (
                  <CheckCircle2 className="h-6 w-6 text-blue-600" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Con esta opción, crearemos una cuenta alternativa con un email modificado.
                  Mantendrás ambas cuentas separadas con sus respectivos datos.
                </p>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>Nueva cuenta:</strong>
                  </p>
                  <p className="text-sm font-mono text-blue-700">
                    {conflictData.alternativeEmail}
                  </p>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>Nota:</strong> Con esta opción, tendrás dos cuentas separadas.
                    Deberás iniciar sesión con el email alternativo para acceder a los datos
                    de tu cuenta anterior.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={() => handleResolveConflict("alternative")}
                  disabled={isResolving}
                  variant="outline"
                  className="w-full"
                >
                  {isResolving && selectedStrategy === "alternative" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando Cuenta Alternativa...
                    </>
                  ) : (
                    "Crear Cuenta Alternativa"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            ¿Necesitas ayuda? Contáctanos en{" "}
            <a href="mailto:support@ialex.com" className="text-purple-600 hover:underline">
              support@ialex.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

