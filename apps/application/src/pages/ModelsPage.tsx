import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  TemplateTable, 
  TemplatePreviewDialog, 
  TemplateSearchBar 
} from "@/components/Modelos";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useNavigate } from "react-router-dom";
import { useCase } from "@/context/CaseContext";
import { usePermissions } from "@/context/CasePermissionsContext";
import { useState } from "react";
import { toast } from "sonner";

export default function ModelsPage() {
  return (
    <section className="w-[70%] h-full mt-20 min-h-screen flex  ">
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
  );
}
