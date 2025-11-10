import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useCase } from "@/context/CaseContext";
import { usePermissions } from "@/context/CasePermissionsContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CaseLayout from "@/components/Cases/CaseLayout";
import { toast } from "sonner";

export default function CasePromptsPage() {
  const { currentCase } = useCase();
  const { can } = usePermissions();
  const [searchValue, setSearchValue] = useState("");
  const [selectedPromptId, setSelectedPromptId] =
    useState<Id<"prompts"> | null>(null);

  return (
    <CaseLayout>
      <section className="w-full h-full flex pt-5">
        <Tabs className="w-full bg-white h-[95%]" defaultValue="library">
          <TabsList className="bg-white w-full p-0">
            <div className="flex gap-4 p-2">
              <TabsTrigger value="library" className="cursor-pointer">
                Biblioteca de Prompts
              </TabsTrigger>
              <TabsTrigger value="custom" className="cursor-pointer">
                Mis Prompts
              </TabsTrigger>
            </div>

            <div className="w-full h-full bg-[#f7f7f7]"> </div>
          </TabsList>

          <TabsContent value="library" className="min-w-[90%]">
            <div className="p-4">
              <p className="text-muted-foreground">
                Biblioteca de prompts - En desarrollo
              </p>
            </div>
          </TabsContent>

          <TabsContent value="custom" className="min-w-[90%]">
            <div className="p-4">
              <p className="text-muted-foreground">
                Mis prompts personalizados - En desarrollo
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </CaseLayout>
  );
}
