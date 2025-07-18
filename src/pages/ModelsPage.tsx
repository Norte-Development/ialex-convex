import ConditionalLayout from "@/components/Layout/ConditionalLayout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ModelsTab from "@/components/Models/ModelsTab";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import MyModelsTab from "@/components/Models/MyModelsTab";

export default function ModelsPage() {
  return (
    <ConditionalLayout>
      <section className="w-full h-full flex   pt-5">
        <Tabs className="w-full bg-white h-[95%]" defaultValue="Modelos">
          <TabsList className="bg-white w-full p-0">
            <div className="flex gap-4 p-2">
              <TabsTrigger value="Modelos" className="cursor-pointer">
                Modelos
              </TabsTrigger>
              <TabsTrigger value="Mis Modelos" className="cursor-pointer">
                Mis modelos
              </TabsTrigger>
            </div>

            <div className="w-full h-full bg-[#f7f7f7]"> </div>
          </TabsList>
          <div className="flex gap-2 w-[40%] pl-2">
            <Input
              placeholder="buscar palabra clave"
              className="bg-gray-200 p-1"
            />
            <button className="border-2 border-green-400 py-0 px-1 cursor-pointer">
              <Plus size={20} className="text-green-400" />
            </button>
          </div>
          <ModelsTab />
          <MyModelsTab />
        </Tabs>
      </section>
    </ConditionalLayout>
  );
}
