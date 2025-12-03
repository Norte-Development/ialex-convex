import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useFreemiumUpgrade } from "@/hooks/useFreemiumUpgrade";
import PlanCard from "./CardPlan";

export function FreemiumUpgradePopup() {
  const { isOpen, close } = useFreemiumUpgrade();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="w-full md:max-w-[90vw] max-w-[90vw]  max-h-[90vh] p-0  overflow-hidden text-white shadow-2xl flex gap-0">
        <div
          className="flex flex-col w-[40%] h-full justify-center items-center text-center"
          style={{
            background:
              "linear-gradient(180deg, #224A8A 7.05%, rgba(99, 179, 255, 0.87) 48.89%, #002146 97.79%)",
          }}
        >
          <p className="text-[55px] font-bold ">IAlex Premium </p>
          <p className="text-[25px]">Potenciá tu práctica con IA sin límites</p>
        </div>
        <div className="flex bg-[#323232] w-[60%] h-full  gap-3 justify-center items-center">
          <PlanCard
            plan="premium_individual"
            points={[
              "Todo el plan gratuito",
              "iAlex ilimitado",
              "Análisis de documentos",
              "Escritos ilimitados",
              "iAlex para WhatsApp",
            ]}
            price={"30.000"}
            title="Usuario"
            description="Ideal si sos un abogado independiente exigente con los resultados"
            isFeatured
            onSuccess={() => close()}
          />
          <PlanCard
            plan="premium_team"
            points={[
              "Todo el plan gratuito",
              "iAlex para WhatsApp",
              "Equipos legales colaborativos",
              "Gestión avanzada de casos",
              "Roles y permisos custom",
            ]}
            price={"200.000"}
            title="Equipo"
            description="Ideal si sos un abogado independiente exigente con los resultados"
            onSuccess={() => close()}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
