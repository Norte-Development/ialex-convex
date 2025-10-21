import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DataBaseTable from "@/components/DataBase/DataBaseTable";
import { useState } from "react";
import CaseLayout from "@/components/Cases/CaseLayout";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useQuery } from "@tanstack/react-query";

export default function CaseDataBasePage() {
  const [category, setCategory] = useState("ley");
  
  const getNormativesFacets = useAction(api.functions.legislation.getNormativesFacets);

  // Fetch jurisdictions once at page level with long cache time
  const { data: jurisdictionsData } = useQuery({
    queryKey: ["all-jurisdictions"],
    queryFn: () => getNormativesFacets({ filters: {} }),
    staleTime: 60 * 60 * 1000, // Cache for 1 hour
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
  });

  // Extract jurisdictions from facets data
  const availableJurisdictions = jurisdictionsData?.jurisdicciones 
    ? ["all", ...Object.keys(jurisdictionsData.jurisdicciones)]
    : ["all"];

  return (
    <CaseLayout>
      <section
        className={`w-full h-full bg-white flex pt-5  flex-col gap-5 px-5`}
      >
        <div className="flex gap-2">
          <Input
            placeholder="buscar palabra clave"
            className="bg-gray-200 p-1 w-[30%]"
          />
          <Select onValueChange={setCategory}>
            <SelectTrigger className="w-[30%] text-sm" size="sm">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ley">Ley</SelectItem>
                <SelectItem value="reglamento">Reglamento</SelectItem>
                <SelectItem value="decreto">Decreto</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <DataBaseTable jurisdictions={availableJurisdictions} />
      </section>
    </CaseLayout>
  );
}
