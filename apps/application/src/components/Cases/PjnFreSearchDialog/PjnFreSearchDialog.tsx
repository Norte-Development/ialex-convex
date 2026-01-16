import { useEffect, useMemo, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Alert, AlertDescription } from "../../ui/alert";
import { Skeleton } from "../../ui/skeleton";
import { toast } from "sonner";

type PjnCaseCandidate = {
  fre: string;
  rawClaveExpediente?: string | null;
  jurisdiction?: string | null;
  caseNumber?: string | null;
  caratula?: string | null;
  rowIndex: number;
};

type CaseHistorySearchOk = {
  status: "OK";
  fre: string;
  cid: string | null;
  candidates: PjnCaseCandidate[];
  caseMetadata?: {
    rowIndex?: number;
    jurisdiction?: string | null;
    caseNumber?: string | null;
    caratula?: string | null;
  };
};

type CaseHistorySearchResult =
  | CaseHistorySearchOk
  | { status: "NOT_FOUND"; fre: string; candidates: PjnCaseCandidate[] }
  | { status: "AUTH_REQUIRED"; reason: string; details?: Record<string, unknown> }
  | { status: "ERROR"; error: string; code?: string };

function parsePjnNumber(pjnNumber: string): { caseNumber: string; year: number } | null {
  const trimmed = pjnNumber.trim();
  const match = trimmed.match(/^(\d+)\/(\d{4})(?:\/.*)?$/);
  if (!match) return null;
  const year = Number(match[2]);
  if (!Number.isFinite(year)) return null;
  return { caseNumber: match[1], year };
}

function splitFre(fullFre: string): { jurisdiction: string; pjnNumber: string } | null {
  const match = fullFre.trim().match(/^([A-Za-z]+)-(.+)$/);
  if (!match) return null;
  return { jurisdiction: match[1].toUpperCase(), pjnNumber: match[2] };
}

export interface PjnFreSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pjnJurisdiction: string;
  pjnNumber: string;
  onPickFre: (args: { jurisdiction: string; pjnNumber: string; fullFre: string }) => void;
}

export function PjnFreSearchDialog(props: PjnFreSearchDialogProps) {
  const searchCaseHistory = useAction(api.pjn.caseHistory.searchCaseHistory);

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CaseHistorySearchResult | null>(null);

  const requestSeq = useRef(0);

  const searchArgs = useMemo(() => {
    const parsed = parsePjnNumber(props.pjnNumber);
    if (!parsed) return null;
    return {
      jurisdiction: props.pjnJurisdiction.trim(),
      caseNumber: parsed.caseNumber,
      year: parsed.year,
    };
  }, [props.pjnJurisdiction, props.pjnNumber]);

  const targetFre = useMemo(() => {
    const jurisdiction = props.pjnJurisdiction.trim().toUpperCase();
    const number = props.pjnNumber.trim();
    if (!jurisdiction || !number) return null;
    return `${jurisdiction}-${number}`;
  }, [props.pjnJurisdiction, props.pjnNumber]);

  useEffect(() => {
    if (!props.open) return;

    if (!searchArgs) {
      setResult(null);
      return;
    }

    let isMounted = true;
    const seq = ++requestSeq.current;

    (async () => {
      setIsLoading(true);
      setResult(null);
      try {
        const res = (await searchCaseHistory(searchArgs)) as CaseHistorySearchResult;
        if (!isMounted || seq !== requestSeq.current) return;
        setResult(res);
      } catch (error) {
        if (!isMounted || seq !== requestSeq.current) return;
        setResult({
          status: "ERROR",
          error: error instanceof Error ? error.message : "Error inesperado",
          code: "CLIENT_ERROR",
        });
      } finally {
        if (!isMounted || seq !== requestSeq.current) return;
        setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [props.open, searchArgs, searchCaseHistory]);

  const handlePick = (candidate: PjnCaseCandidate) => {
    const split = splitFre(candidate.fre);
    if (!split) {
      toast.error("No pude interpretar el FRE devuelto por PJN", {
        description: candidate.fre,
      });
      return;
    }

    props.onPickFre({
      jurisdiction: split.jurisdiction,
      pjnNumber: split.pjnNumber,
      fullFre: candidate.fre,
    });

    toast.success("FRE seleccionado", { description: candidate.fre });
    props.onOpenChange(false);
  };

  const selectedFre =
    result?.status === "OK" && result.caseMetadata?.rowIndex !== undefined
      ? result.fre
      : null;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[780px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buscar expediente en PJN</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {targetFre ? (
              <>
                Buscando coincidencias para:{" "}
                <span className="font-mono text-foreground">{targetFre}</span>
              </>
            ) : (
              "Completá Jurisdicción y Número (ej: 4715/2025) para buscar."
            )}
          </div>

          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {!isLoading && result?.status === "AUTH_REQUIRED" && (
            <Alert variant="destructive">
              <AlertDescription>
                Autenticación requerida en PJN: {result.reason}
              </AlertDescription>
            </Alert>
          )}

          {!isLoading && result?.status === "NOT_FOUND" && (
            <Alert>
              <AlertDescription>
                No se encontraron expedientes para{" "}
                <span className="font-mono">{result.fre}</span>.
              </AlertDescription>
            </Alert>
          )}

          {!isLoading && result?.status === "ERROR" && (
            <Alert variant="destructive">
              <AlertDescription>
                Error al buscar: {result.error}
                {result.code ? (
                  <span className="ml-2 text-xs opacity-75">
                    (código: {result.code})
                  </span>
                ) : null}
              </AlertDescription>
            </Alert>
          )}

          {!isLoading && result?.status === "OK" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  Candidatos ({result.candidates.length})
                </div>
                {selectedFre ? (
                  <div className="text-xs text-emerald-700 dark:text-emerald-300">
                    Auto-seleccionado:{" "}
                    <span className="font-mono">{selectedFre}</span>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Seleccioná el expediente correcto
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {result.candidates.map((candidate) => {
                  const isAutoSelected =
                    selectedFre !== null && candidate.fre === selectedFre;

                  return (
                    <div
                      key={`${candidate.fre}-${candidate.rowIndex}`}
                      className={[
                        "border rounded-md p-3 space-y-1",
                        isAutoSelected
                          ? "border-emerald-500/50 bg-emerald-500/5"
                          : "bg-background",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm">
                            <span className="font-semibold">FRE:</span>{" "}
                            <span className="font-mono break-all">{candidate.fre}</span>
                          </div>
                          {candidate.caratula ? (
                            <div className="text-sm text-muted-foreground">
                              {candidate.caratula}
                            </div>
                          ) : null}
                          {candidate.rawClaveExpediente ? (
                            <div className="text-xs text-muted-foreground">
                              Clave: {candidate.rawClaveExpediente}
                            </div>
                          ) : null}
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant={isAutoSelected ? "default" : "outline"}
                          onClick={() => handlePick(candidate)}
                        >
                          Usar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!isLoading && props.open && !searchArgs && (
            <div className="text-sm text-muted-foreground">
              Tip: ingresá el número en formato{" "}
              <span className="font-mono">4715/2025</span> (opcionalmente con
              sufijo, ej <span className="font-mono">4715/2025/TO2</span>).
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

