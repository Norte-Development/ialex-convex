import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFreemiumUpgrade } from "@/hooks/useFreemiumUpgrade";
import PlanCard from "./CardPlan";

export function FreemiumUpgradePopup() {
  const { isOpen, close } = useFreemiumUpgrade();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="w-full md:max-w-[90vw] flex-col md:flex-row max-w-[90vw]  max-h-[90vh] p-0  overflow-hidden text-white shadow-2xl flex gap-0">
        <div
          className="flex flex-col w-full md:w-[40%] h-[30%] md:h-full justify-center items-center text-center p-6"
          style={{
            background:
              "linear-gradient(180deg, #224A8A 7.05%, rgba(99, 179, 255, 0.87) 48.89%, #002146 97.79%)",
          }}
        >
          <p className="md:text-[55px] text-[25px] font-bold ">
            IAlex Premium{" "}
          </p>
          <p className=" md:text-[25px]  text-[15px]">
            Potenciá tu práctica con IA sin límites
          </p>
        </div>

        {/* Desktop: Mostrar ambas cards lado a lado */}
        <div className="hidden md:flex bg-[#323232] w-full md:w-[60%] h-full  gap-3 justify-center items-center">
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

        {/* Mobile: Mostrar tabs */}
        <div className="md:hidden bg-[#323232] w-full h-full flex flex-col">
          <Tabs defaultValue="usuario" className="w-full h-full flex flex-col ">
            <TabsList className="w-full grid grid-cols-2 bg-[#1a1a1a] rounded-none">
              <TabsTrigger
                value="usuario"
                className="text-white data-[state=active]:bg-[#323232]"
              >
                Usuario
              </TabsTrigger>
              <TabsTrigger
                value="equipo"
                className="text-white data-[state=active]:bg-[#323232]"
              >
                Equipo
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="usuario"
              className="flex-1 flex justify-center items-center p-1 mt-0"
            >
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
            </TabsContent>
            <TabsContent
              value="equipo"
              className="flex-1 flex justify-center items-center p-1 mt-0"
            >
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
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
