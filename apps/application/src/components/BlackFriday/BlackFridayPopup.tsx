import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBlackFridayPromo } from "@/hooks/useBlackFridayPromo";
import { useUpgrade } from "@/components/Billing/useUpgrade";
import { BLACK_FRIDAY_CONFIG } from "@/config/blackFriday";
import { Check, Zap, Users } from "lucide-react";

export function BlackFridayPopup() {
  const { isOpen, close } = useBlackFridayPromo();
  const { upgradeToPlan, isUpgrading } = useUpgrade({
    onSuccess: () => {
      close();
    }
  });

  const handleUpgrade = (plan: "premium_individual" | "premium_team") => {
    upgradeToPlan(plan, BLACK_FRIDAY_CONFIG.couponId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden bg-black text-white border-gray-800 shadow-2xl">
        <div className="flex flex-col md:flex-row h-full">
            {/* Image / Branding Section */}
            <div className="w-full md:w-5/12 bg-gradient-to-br from-[#130261] to-black relative min-h-[200px] md:min-h-full flex flex-col items-center justify-center p-8 overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500 via-transparent to-transparent" />
                
                <div className="relative z-10 text-center space-y-4">
                    <div className="inline-block px-3 py-1 rounded-full bg-indigo-600/20 border border-indigo-500/30 backdrop-blur-sm text-sm font-bold tracking-wider text-indigo-300 mb-2">
                        30% OFF
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white leading-none">
                        BLACK<br/>FRIDAY
                    </h2>
                    <div className="w-16 h-1 bg-indigo-500 mx-auto rounded-full" />
                    <p className="text-indigo-200 text-lg font-medium">
                        Potencia tu estudio<br/>con Inteligencia Artificial
                    </p>
                </div>
            </div>

            {/* Content Section */}
            <div className="w-full md:w-7/12 p-6 md:p-8 flex flex-col bg-zinc-950 relative">
              
                <div className="mb-6">
                    <h3 className="text-2xl font-bold text-white mb-2">30% de Descuento Especial</h3>
                    <p className="text-gray-400">Accede a la suite legal más avanzada con un precio único por tiempo limitado.</p>
                </div>

                {/* Features List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    {[
                        "Consultas ilimitadas con IA",
                        "Análisis de documentos",
                        "Gestión de casos sin límites",
                        "Redacción automática",
                        "Acceso a modelos exclusivos",
                        "Soporte prioritario"
                    ].map((feature, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span className="text-sm text-gray-300">{feature}</span>
                        </div>
                    ))}
                </div>

                {/* Plans Buttons */}
                <div className="space-y-3 mt-auto">
                    <Button 
                        onClick={() => handleUpgrade("premium_individual")} 
                        disabled={isUpgrading}
                        className="w-full bg-white text-black hover:bg-gray-200 font-bold h-auto py-4 px-6 flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-black/5 rounded-lg">
                                <Zap className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-semibold">Premium Individual</div>
                                <div className="text-xs font-normal text-gray-500">Para abogados independientes</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-bold group-hover:translate-x-1 transition-transform">Obtener 30% OFF →</div>
                        </div>
                    </Button>

                    <Button 
                        onClick={() => handleUpgrade("premium_team")} 
                        disabled={isUpgrading}
                        variant="outline"
                        className="w-full border-gray-800 text-white hover:bg-gray-900 hover:text-white h-auto py-4 px-6 flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg">
                                <Users className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-semibold text-black">Premium Equipo</div>
                                <div className="text-xs font-normal text-gray-500">Para estudios jurídicos</div>
                            </div>
                        </div>
                         <div className="text-right">
                            <div className="text-sm font-bold group-hover:translate-x-1 transition-transform text-indigo-400">Ver 30% OFF →</div>
                        </div>
                    </Button>
                </div>
                
                <p className="text-xs text-center text-gray-600 mt-6">
                    La oferta se aplicará automáticamente en el checkout. Válido hasta el 5/12.
                </p>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

