/**
 * Test Runner Component
 * 
 * Simple UI to run tests in the browser and see results.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { runAllTypeTests } from "./types.test";
import { TestUseHomeThreads } from "./hooks.test";
import { StreamingTest } from "./streaming.test";

export function TestRunner() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | undefined>(undefined);

  const captureConsole = (fn: () => boolean) => {
    const originalLog = console.log;
    const originalError = console.error;
    const captured: string[] = [];

    console.log = (...args: any[]) => {
      captured.push(args.map(String).join(" "));
      originalLog(...args);
    };

    console.error = (...args: any[]) => {
      captured.push("❌ ERROR: " + args.map(String).join(" "));
      originalError(...args);
    };

    try {
      fn();
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }

    return captured;
  };

  const runTests = (testFn: () => boolean) => {
    setIsRunning(true);
    setLogs([]);

    setTimeout(() => {
      const captured = captureConsole(testFn);
      setLogs(captured);
      setIsRunning(false);
    }, 100);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>🧪 HomeAgent Test Runner</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="types" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="types">1. Types</TabsTrigger>
              <TabsTrigger value="hooks">2. Hooks</TabsTrigger>
              <TabsTrigger value="streaming">3. Streaming</TabsTrigger>
              <TabsTrigger value="plan">Plan</TabsTrigger>
            </TabsList>

            {/* TYPES TAB */}
            <TabsContent value="types" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Type Validation Tests</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => runTests(runAllTypeTests)}
                      disabled={isRunning}
                    >
                      {isRunning ? "Running..." : "Run Type Tests"}
                    </Button>
                  </div>

                  {logs.length > 0 && (
                    <Card className="bg-black text-green-400 font-mono text-xs">
                      <CardContent className="p-4 space-y-1 max-h-96 overflow-y-auto">
                        {logs.map((log, i) => (
                          <div key={i} className="whitespace-pre-wrap">
                            {log}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* HOOKS TAB */}
            <TabsContent value="hooks" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">useHomeThreads Hook Test</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Thread ID (opcional - deja vacío para ver solo lista)
                    </label>
                    <input
                      type="text"
                      value={selectedThreadId || ""}
                      onChange={(e) => setSelectedThreadId(e.target.value || undefined)}
                      placeholder="Pega un threadId aquí..."
                      className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                    />
                  </div>

                  <TestUseHomeThreads threadId={selectedThreadId} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* STREAMING TAB */}
            <TabsContent value="streaming" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Streaming Test</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Thread ID (requerido para testear streaming)
                    </label>
                    <input
                      type="text"
                      value={selectedThreadId || ""}
                      onChange={(e) => setSelectedThreadId(e.target.value || undefined)}
                      placeholder="Pega un threadId aquí..."
                      className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                    />
                    {!selectedThreadId && (
                      <p className="text-xs text-amber-600">
                        ⚠️ Necesitas un threadId para testear streaming. Créalo en la tab "Hooks" primero.
                      </p>
                    )}
                  </div>

                  <StreamingTest threadId={selectedThreadId} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* PLAN TAB */}
            <TabsContent value="plan" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">📋 Test Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-green-600">✅ FASE 1:</span>
                        <span className="font-semibold">Validar Types</span>
                      </div>
                      <div className="pl-6 text-sm text-muted-foreground">
                        <div>• Verificar interfaces de mensajes</div>
                        <div>• Verificar interfaces de threads</div>
                        <div>• Verificar props de componentes UI</div>
                        <div>• Validar compatibilidad de tipos</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-blue-600">🔄 FASE 2:</span>
                        <span className="font-semibold">Validar Hooks</span>
                      </div>
                      <div className="pl-6 text-sm text-muted-foreground">
                        <div>• Testear useHomeThreads unificado</div>
                        <div>• Verificar queries de threads</div>
                        <div>• Verificar queries de mensajes</div>
                        <div>• Testear createThread y sendMessage</div>
                        <div>• Validar estados de loading</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-blue-600">🔄 FASE 3:</span>
                        <span className="font-semibold">Validar Streaming</span>
                      </div>
                      <div className="pl-6 text-sm text-muted-foreground">
                        <div>• Verificar streaming en tiempo real</div>
                        <div>• Monitorear velocidad de caracteres</div>
                        <div>• Validar que no aparezca todo de golpe</div>
                        <div>• Testear con mensajes cortos, medios y largos</div>
                        <div>• Verificar ~50-100 chars/sec</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="font-bold">⏳ FASE 4:</span>
                        <span className="font-semibold">UI Completa</span>
                      </div>
                      <div className="pl-6 text-sm text-muted-foreground">
                        <div>• Implementar componentes finales</div>
                        <div>• Integrar todo el sistema</div>
                        <div>• Tests end-to-end</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
