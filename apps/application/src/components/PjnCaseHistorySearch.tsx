import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Search, AlertCircle, CheckCircle2 } from "lucide-react";

export function PjnCaseHistorySearch() {
  const searchCaseHistory = useAction(api.pjn.caseHistory.searchCaseHistory);

  const [jurisdiction, setJurisdiction] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [year, setYear] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<{
    status: string;
    fre?: string;
    cid?: string | null;
    candidates?: Array<unknown>;
    error?: string;
    reason?: string;
    code?: string;
  } | null>(null);

  const handleSearch = async () => {
    // Validate that all required fields are provided
    if (!jurisdiction || !caseNumber || !year) {
      toast.error("Ingresá jurisdicción, número de expediente y año");
      return;
    }

    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
      toast.error("Ingresá un año válido");
      return;
    }

    setIsSearching(true);
    setResult(null);

    try {
      const searchResult = await searchCaseHistory({
        jurisdiction,
        caseNumber,
        year: yearNum,
      });

      setResult(searchResult);

      if (searchResult.status === "OK") {
        toast.success(`Búsqueda exitosa. ${searchResult.candidates?.length || 0} candidatos encontrados.`);
      } else if (searchResult.status === "NOT_FOUND") {
        toast.info("No se encontraron expedientes con los criterios de búsqueda.");
      } else if (searchResult.status === "AUTH_REQUIRED") {
        toast.error(`Autenticación requerida: ${searchResult.reason}`);
      } else {
        toast.error(`Error: ${searchResult.error || "Error desconocido"}`);
      }
    } catch (error) {
      console.error("Error searching case history:", error);
      toast.error("Error inesperado al buscar expedientes");
      setResult({
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Búsqueda de Historial de Expedientes PJN</CardTitle>
        <CardDescription>
          Buscar expedientes en el portal PJN usando el scraper. Esta es una herramienta de prueba.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="jurisdiction">Jurisdicción *</Label>
            <Input
              id="jurisdiction"
              placeholder="Ej: 23 o FRE"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="caseNumber">Número de Expediente *</Label>
            <Input
              id="caseNumber"
              placeholder="Ej: 3852"
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="year">Año *</Label>
            <Input
              id="year"
              type="number"
              placeholder="Ej: 2020"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min="1900"
              max="2100"
              required
            />
          </div>
        </div>

        <Button
          onClick={handleSearch}
          disabled={isSearching}
          className="w-full"
        >
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Buscar
            </>
          )}
        </Button>

        {result && (
          <div className="mt-4 space-y-2">
            {result.status === "OK" && (
              <Alert className="border-emerald-500/30 bg-emerald-500/10">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <AlertDescription className="text-emerald-800 dark:text-emerald-300">
                  <div className="space-y-1">
                    <p className="font-semibold">Búsqueda exitosa</p>
                    <p>FRE: <span className="font-mono">{result.fre}</span></p>
                    {result.cid && (
                      <p>CID seleccionado: <span className="font-mono">{result.cid}</span></p>
                    )}
                    <p>Candidatos encontrados: {result.candidates?.length || 0}</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {result.status === "NOT_FOUND" && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No se encontraron expedientes con los criterios de búsqueda.
                  {result.fre && <p className="mt-1">FRE buscado: <span className="font-mono">{result.fre}</span></p>}
                </AlertDescription>
              </Alert>
            )}

            {result.status === "AUTH_REQUIRED" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Autenticación requerida: {result.reason}
                </AlertDescription>
              </Alert>
            )}

            {result.status === "ERROR" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-semibold">Error en la búsqueda</p>
                    <p>{result.error}</p>
                    {result.code && (
                      <p className="text-sm opacity-75">Código: {result.code}</p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {result.candidates && result.candidates.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold mb-2">Candidatos encontrados:</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {result.candidates.map((candidate: any, index: number) => (
                    <Card key={index} className="p-3">
                      <div className="space-y-1 text-sm">
                        <p><span className="font-semibold">FRE:</span> <span className="font-mono">{candidate.fre}</span></p>
                        {candidate.rawClaveExpediente && (
                          <p><span className="font-semibold">Clave Expediente:</span> {candidate.rawClaveExpediente}</p>
                        )}
                        {candidate.caratula && (
                          <p><span className="font-semibold">Carátula:</span> {candidate.caratula}</p>
                        )}
                        <p><span className="font-semibold">CID:</span> <span className="font-mono">{candidate.cid}</span></p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
