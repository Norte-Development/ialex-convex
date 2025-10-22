import { useState } from "react";
import DataBaseTable from "@/components/DataBase/DataBaseTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useQuery } from "@tanstack/react-query";

export default function DataBasePage() {
  const [activeView, setActiveView] = useState<"simple" | "advanced">("simple");
  
  const getNormativesFacets = useAction(api.functions.legislation.getNormativesFacets);

  // Fetch jurisdictions once at page level with long cache time
  // No filters applied to get all available jurisdictions
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
    <section
      className={`w-[70%] h-full min-h-screen mt-18 bg-white flex py-5 px-5 flex-col gap-5 `}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Base de Datos Legislativa
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
