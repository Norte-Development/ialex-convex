import DataBaseTable from "@/components/DataBase/DataBaseTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { DataBasePageSkeleton } from "@/components/DataBase/Skeletons/DataBasePageSkeleton";

export default function DataBasePage() {
  const getNormativesFacets = useAction(
    api.functions.legislation.getNormativesFacets,
  );
  const getNormatives = useAction(api.functions.legislation.getNormatives);

  // Fetch jurisdictions from legislation
  const {
    data: normativesJurisdictionsData,
    isLoading: isNormativesJurisdictionsLoading,
  } = useQuery({
    queryKey: ["normatives-jurisdictions"],
    queryFn: () => getNormativesFacets({ filters: {} }),
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
    isInitialFacetsLoading ||
    !initialFacets ||
    isInitialTableLoading ||
    !initialTableData
  ) {
    return <DataBasePageSkeleton />;
  }

  // Extract jurisdictions from normatives data
  const normativesJurisdictions = normativesJurisdictionsData.jurisdicciones
    ? normativesJurisdictionsData.jurisdicciones.map(
        (j: { name: string; count: number }) => j.name,
      )
    : [];

  const availableJurisdictions = ["all", ...normativesJurisdictions];

  return (
    <section
      className={`w-[70%] h-full min-h-screen mt-18 bg-white flex py-5 px-5 flex-col gap-5 `}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Base de Datos Legal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataBaseTable jurisdictions={availableJurisdictions} />
        </CardContent>
      </Card>
    </section>
  );
}
