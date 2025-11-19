import { useState, useEffect } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { useQuery as useReactQuery } from "@tanstack/react-query";
import { api } from "../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageCircle, XCircle, Loader2, QrCode, ShieldCheck, Scale, Lock, FileText, Smartphone, AlertCircle } from 'lucide-react';
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";

type VerificationState = "idle" | "sending" | "code-sent" | "verifying" | "success" | "error";

export function WhatsAppSection() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationState, setVerificationState] = useState<VerificationState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const currentUser = useQuery(api.functions.users.getCurrentUser, {});
  const requestVerification = useAction(api.functions.users.requestWhatsappVerification);
  const verifyCode = useAction(api.functions.users.verifyWhatsappCode);
  const disconnectWhatsapp = useMutation(api.functions.users.disconnectWhatsapp);
  const getWhatsappNumberAction = useAction(api.functions.users.getWhatsappNumber);

  const isConnected: boolean = 
    currentUser?.preferences?.whatsappVerified === true && 
    Boolean(currentUser?.preferences?.whatsappNumber);
  
  const isVerifying = verificationState === "verifying";
  const isCodeSent = verificationState === "code-sent";

  const { data: whatsappNumberData } = useReactQuery({
    queryKey: ["whatsapp-number"],
    queryFn: () => getWhatsappNumberAction({}),
    enabled: isConnected,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const whatsappNumber = whatsappNumberData?.number || null;

  useEffect(() => {
    if (isConnected) {
      setVerificationState("idle");
      setPhoneNumber("");
      setVerificationCode("");
      setErrorMessage("");
    }
  }, [isConnected]);

  const handleRequestVerification = async () => {
    if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
      setErrorMessage("Formato inválido. Debe ser E.164 (ej., +5434567890)");
      return;
    }

    setErrorMessage("");
    setVerificationState("sending");

    try {
      await requestVerification({ phoneNumber });
      setVerificationState("code-sent");
      toast.success("Código de verificación enviado a tu WhatsApp");
    } catch (error: any) {
      setVerificationState("error");
      setErrorMessage(error.message || "Error al enviar el código de verificación");
      toast.error("Error al enviar el código de verificación");
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setErrorMessage("El código debe tener 6 dígitos");
      return;
    }

    setErrorMessage("");
    setVerificationState("verifying");

    try {
      await verifyCode({ phoneNumber, code: verificationCode });
      setVerificationState("success");
      toast.success("Canal seguro establecido exitosamente");
      setPhoneNumber("");
      setVerificationCode("");
      setTimeout(() => {
        setVerificationState("idle");
      }, 2000);
    } catch (error: any) {
      setVerificationState("code-sent");
      setErrorMessage(error.message || "Código inválido o expirado");
      toast.error("Código inválido o expirado");
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectWhatsapp({});
      toast.success("Canal desconectado exitosamente");
      setVerificationState("idle");
      setPhoneNumber("");
      setVerificationCode("");
    } catch (error: any) {
      toast.error("Error al desconectar el canal");
    }
  };

  return (
    <section id="whatsapp-legal" className="scroll-mt-8 max-w-3xl mx-auto">
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-slate-800">
              <Scale className="h-5 w-5" />
              <h3 className="font-serif text-lg font-medium tracking-tight">Canal de Comunicación Legal</h3>
            </div>
            <p className="text-sm text-slate-500 max-w-md">
              Establece una conexión verificada y encriptada para conversar directamente con el asistente legal por IA mediante WhatsApp.
            </p>
          </div>
          <Badge variant="outline" className="bg-white text-slate-600 border-slate-300 gap-1.5 py-1.5">
            <Lock className="h-3 w-3" />
            Encriptado de Extremo a Extremo
          </Badge>
        </div>

        <CardContent className="p-6 space-y-8">
          {isConnected ? (
            <div className="space-y-6">
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-4 flex items-start gap-4">
                <div className="bg-emerald-100 p-2 rounded-full">
                  <ShieldCheck className="h-6 w-6 text-emerald-700" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-emerald-900">Canal Seguro Activo</h4>
                  <p className="text-sm text-emerald-700">
                    Tu cuenta está verificada y lista para conversar con el asistente legal por IA desde el número <span className="font-mono font-medium">{currentUser?.preferences?.whatsappNumber}</span>
                  </p>
                </div>
              </div>

              {whatsappNumber && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-slate-900 flex items-center gap-2">
                        <QrCode className="h-4 w-4" />
                        Acceso Rápido
                      </h4>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        Escanea este código para abrir inmediatamente el chat seguro con el asistente legal por IA en tu dispositivo.
                      </p>
                    </div>
                    <div className="bg-white p-4 border border-slate-200 rounded-lg w-fit shadow-sm">
                      <QRCodeSVG
                        value={`https://wa.me/${whatsappNumber}`}
                        size={140}
                        level="H"
                        fgColor="#0f172a"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 flex flex-col justify-center">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-slate-900 flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        Enlace Directo
                      </h4>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        Alternativamente, haz clic en el botón de abajo para abrir el chat con el asistente legal por IA directamente.
                      </p>
                    </div>
                    <Button 
                      className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-sm"
                      asChild
                    >
                      <a
                        href={`https://wa.me/${whatsappNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Abrir Chat con IA Legal
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-[1fr_200px]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber" className="text-slate-700">
                      Número de Teléfono
                    </Label>
                    <div className="flex gap-3">
                      <Input
                        id="phoneNumber"
                        type="tel"
                        placeholder="+54934567890"
                        value={phoneNumber}
                        onChange={(e) => {
                          setPhoneNumber(e.target.value);
                          setErrorMessage("");
                        }}
                        disabled={verificationState !== "idle" && verificationState !== "error"}
                        className="font-mono text-slate-600 bg-slate-50 border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                      />
                      <Button
                        onClick={handleRequestVerification}
                        disabled={
                          !phoneNumber ||
                          (verificationState !== "idle" && verificationState !== "error")
                        }
                        className="bg-slate-900 text-white hover:bg-slate-800 min-w-[120px]"
                      >
                        {verificationState === "sending" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          "Verificar"
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <AlertCircle className="h-3 w-3" />
                      Formato: E.164 (ej., +1 555 000 0000)
                    </p>
                  </div>

                  {isCodeSent && (
                    <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
                      <Label htmlFor="verificationCode" className="text-slate-700">
                        Código de Verificación
                      </Label>
                      <div className="flex gap-3">
                        <Input
                          id="verificationCode"
                          type="text"
                          placeholder="000000"
                          value={verificationCode}
                          onChange={(e) => {
                            setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                            setErrorMessage("");
                          }}
                          disabled={isVerifying}
                          className="font-mono text-slate-600 bg-slate-50 border-slate-200 focus:border-slate-400 focus:ring-slate-400 tracking-widest"
                          maxLength={6}
                        />
                        <Button
                          onClick={handleVerifyCode}
                          disabled={
                            !verificationCode ||
                            verificationCode.length !== 6 ||
                            isVerifying
                          }
                          className="bg-emerald-600 text-white hover:bg-emerald-700 min-w-[120px]"
                        >
                          {isVerifying ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Verificando...
                            </>
                          ) : (
                            "Confirmar"
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">
                        Ingresa el código de 6 dígitos enviado a tu dispositivo.
                      </p>
                    </div>
                  )}
                </div>

                <div className="hidden md:flex flex-col items-center justify-center p-4 bg-slate-50 rounded-lg border border-slate-100 text-center space-y-2">
                  <FileText className="h-8 w-8 text-slate-300" />
                  <p className="text-xs text-slate-400 font-medium">
                    Tus conversaciones con el asistente legal por IA serán archivadas de forma segura.
                  </p>
                </div>
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-md text-red-600 text-sm">
                  <XCircle className="h-4 w-4" />
                  {errorMessage}
                </div>
              )}
            </div>
          )}
        </CardContent>

        {isConnected && (
          <CardFooter className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center">
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Lock className="h-3 w-3" />
              La conexión está encriptada y cumple con las normativas.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              className="text-slate-500 hover:text-red-600 hover:bg-red-50 h-8 text-xs"
            >
              Revocar Acceso
            </Button>
          </CardFooter>
        )}
      </Card>
    </section>
  );
}
