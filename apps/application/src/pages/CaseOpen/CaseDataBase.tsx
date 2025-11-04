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
    ? ["all", ...jurisdictionsData.jurisdicciones.map((j: { name: string; count: number }) => j.name)]
    : ["all"];

  return (
    <CaseLayout>
      <section
        className={`w-full h-full bg-white flex pt-5  flex-col gap-5 px-5`}
      >
        <DataBaseTable jurisdictions={availableJurisdictions} />
      </section>
    </CaseLayout>
  );
}
