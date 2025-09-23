import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ModelsTab from "@/components/Models/ModelsTab";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import MyModelsTab from "@/components/Models/MyModelsTab";
import { Button } from "@/components/ui/button";

export default function ModelsPage() {
  return (
    <section className="w-[80%] h-full mt-14 min-h-screen flex  ">
      <Tabs
        className="w-full bg-white h-[95%] min-h-screen"
        defaultValue="Modelos"
      >
        <TabsList className="bg-white w-[50%] p-0 h-full">
          <div className="flex gap-4 p-2 w-full">
            <TabsTrigger value="Modelos" className="cursor-pointer w-fit">
              Modelos
            </TabsTrigger>
            <TabsTrigger value="Mis Modelos" className="cursor-pointer w-fit">
              Mis modelos
            </TabsTrigger>
          </div>
        </TabsList>
        <div className="flex justify-between gap-2 w-[40%] pl-2 ">
          <Input
            placeholder="Buscar modelo"
            className="bg-white border border-[#C2C2C2] w-[65%]"
          />
          <Button size={"icon"} variant={"secondary"} className="bg-[#E2EFF7]">
            <Plus size={20} className="text-[#633B48] rounded-full" />
          </Button>
        </div>
        <ModelsTab />
        <MyModelsTab />
      </Tabs>
    </section>
  );
}
