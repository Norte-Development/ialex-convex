import { useState } from "react";
import DataBaseTable from "@/components/DataBase/DataBaseTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DataBasePage() {
  const [activeView, setActiveView] = useState<"simple" | "advanced">("simple");

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
            <DataBaseTable />
        </CardContent>
      </Card>
    </section>
  );
}
