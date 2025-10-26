import { useState } from "react";
import DataBaseTable from "@/components/DataBase/DataBaseTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { DataBasePageSkeleton } from "@/components/DataBase/Skeletons/DataBasePageSkeleton";

export default function DataBasePage() {
  const [activeView, setActiveView] = useState<"simple" | "advanced">("simple");

  const getNormativesFacets = useAction(
    api.functions.legislation.getNormativesFacets,
  );
  const getFallosFacets = useAction(
    api.functions.fallos.getFallosFacets,
  );
  const getNormatives = useAction(api.functions.legislation.getNormatives);
  const getFallos = useAction(api.functions.fallos.listFallos);

  // Fetch jurisdictions from both legislation and fallos
  const { data: normativesJurisdictionsData, isLoading: isNormativesJurisdictionsLoading } = useQuery({
    queryKey: ["normatives-jurisdictions"],
    queryFn: () => getNormativesFacets({ filters: {} }),
    staleTime: 60 * 60 * 1000, // Cache for 1 hour
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
  });

  const { data: fallosJurisdictionsData, isLoading: isFallosJurisdictionsLoading } = useQuery({
    queryKey: ["fallos-jurisdictions"],
    queryFn: () => getFallosFacets({ filters: {} }),
    staleTime: 60 * 60 * 1000, // Cache for 1 hour
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
  });

  // Also fetch initial facets to ensure everything is ready before showing UI
  const { data: initialFacets, isLoading: isInitialFacetsLoading } = useQuery({
    queryKey: ["normatives-facets", "all", {}],
    queryFn: () => getNormativesFacets({ filters: {} }),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch initial table data
  const { data: initialTableData, isLoading: isInitialTableLoading } = useQuery(
    {
      queryKey: [
        "getNormatives",
        "all",
        {},
        "",
        1,
        25,
        "sanction_date",
        "desc",
      ],
      queryFn: () =>
        getNormatives({
          filters: {},
          limit: 25,
          offset: 0,
          sortBy: "sanction_date",
          sortOrder: "desc",
        }),
      staleTime: 5 * 60 * 1000,
    },
  );

  // Show skeleton while loading initial data - wait for ALL queries
  if (
    isNormativesJurisdictionsLoading ||
    !normativesJurisdictionsData ||
    isFallosJurisdictionsLoading ||
    !fallosJurisdictionsData ||
    isInitialFacetsLoading ||
    !initialFacets ||
    isInitialTableLoading ||
    !initialTableData
  ) {
    return <DataBasePageSkeleton />;
  }

  // Extract jurisdictions from both data sources and combine them
  const normativesJurisdictions = normativesJurisdictionsData.jurisdicciones
    ? Object.keys(normativesJurisdictionsData.jurisdicciones)
    : [];
  const fallosJurisdictions = fallosJurisdictionsData.jurisdicciones
    ? Object.keys(fallosJurisdictionsData.jurisdicciones)
    : [];
  
  // Combine and deduplicate jurisdictions
  const allJurisdictions = Array.from(new Set([...normativesJurisdictions, ...fallosJurisdictions]));
  const availableJurisdictions = ["all", ...allJurisdictions];

  return (
    <section
      className={`w-[70%] h-full min-h-screen mt-18 bg-white flex py-5 px-5 flex-col gap-5 `}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Base de Datos Legal
            <div className="flex gap-2">
              <Button
                variant={activeView === "simple" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveView("simple")}
              >
                Vista Simple
              </Button>
              <Button
                variant={activeView === "advanced" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveView("advanced")}
              >
                Vista Avanzada
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataBaseTable jurisdictions={availableJurisdictions} />
        </CardContent>
      </Card>
    </section>
  );
}
