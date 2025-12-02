import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFreemiumUpgrade } from "@/hooks/useFreemiumUpgrade";
import { useUpgrade } from "@/components/Billing/useUpgrade";
import { Check, Zap, Users } from "lucide-react";

export function FreemiumUpgradePopup() {
  const { isOpen, close } = useFreemiumUpgrade();
  const { upgradeToPlan, isUpgrading } = useUpgrade({
    onSuccess: () => {
      close();
    }
  });

  const handleUpgrade = (plan: "premium_individual" | "premium_team") => {
    upgradeToPlan({ plan, period: "monthly" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden bg-gradient-to-br from-[#130261] to-[#1a0880] text-white border-[#130261] shadow-2xl">
        <div className="flex flex-col md:flex-row h-full">
            {/* Branding Section */}
            <div className="w-full md:w-5/12 bg-gradient-to-br from-[#130261] via-[#1a0880] to-black relative min-h-[200px] md:min-h-full flex flex-col items-center justify-center p-8 overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-500 via-transparent to-transparent" />
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl" />
                
                <div className="relative z-10 text-center space-y-4">
              
                    
                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white leading-none">
                        iAlex<br/>Premium
                    </h2>
                    
                    
                    <p className="text-purple-200 text-lg font-medium leading-relaxed">
                        Lleva tu práctica legal<br/>al siguiente nivel con<br/>IA ilimitada
                    </p>
                </div>
            </div>

            {/* Content Section */}
            <div className="w-full md:w-7/12 p-6 md:p-8 flex flex-col bg-white text-gray-900 relative">
              
                <div className="mb-6">
                    <h3 className="text-2xl font-bold text-[#130261] mb-2"> Actualiza a Premium</h3>
                    <p className="text-gray-600">Accede a herramientas profesionales sin límites y optimiza tu flujo de trabajo legal.</p>
                </div>

                {/* Features List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 mb-8 py-2">
                    {[
                        "Consultas ilimitadas con IA",
                        "Análisis de documentos",
                        "Gestión de casos sin límites",
                        "Redacción automática",
                        "Acceso a modelos exclusivos",
                        "Soporte prioritario"
                    ].map((feature, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#130261]/10 flex items-center justify-center">
                                <Check className="w-3 h-3 text-[#130261]" />
                            </div>
                            <span className="text-sm text-gray-700">{feature}</span>
                        </div>
                    ))}
                </div>

                {/* Plans Buttons */}
                <div className="space-y-3 mt-auto">
                    <Button 
                        onClick={() => handleUpgrade("premium_individual")} 
                        disabled={isUpgrading}
                        className="w-full bg-[#130261] text-white hover:bg-[#1a0880] font-bold h-auto py-4 px-6 flex items-center justify-between group shadow-lg"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-semibold">Premium Individual</div>
                                <div className="text-xs font-normal text-white/80">Para abogados independientes</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-bold group-hover:translate-x-1 transition-transform">Empezar →</div>
                        </div>
                    </Button>

                    <Button 
                        onClick={() => handleUpgrade("premium_team")} 
                        disabled={isUpgrading}
                        variant="outline"
                        className="w-full border-2 border-[#130261] text-[#130261] hover:bg-[#130261]/5 h-auto py-4 px-6 flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#130261]/10 rounded-lg">
                                <Users className="w-5 h-5 text-[#130261]" />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-semibold">Premium Equipo</div>
                                <div className="text-xs font-normal text-gray-500">Para estudios jurídicos</div>
                            </div>
                        </div>
                         <div className="text-right">
                            <div className="text-sm font-bold group-hover:translate-x-1 transition-transform">Ver planes →</div>
                        </div>
                    </Button>
                </div>
                
                <p className="text-xs text-center text-gray-500 mt-6">
                    Cancela cuando quieras. Sin compromisos a largo plazo.
                </p>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
