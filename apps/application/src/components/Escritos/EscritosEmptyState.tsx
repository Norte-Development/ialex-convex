import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { useState } from "react";
import { CreateEscritoDialog } from "@/components/CreateEscritoDialog";

export default function EscritosEmptyState() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Card className="max-w-md mx-auto mt-10">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No hay escritos disponibles
          </h3>
          <p className="text-gray-500 text-center mb-4">
            Aún no se han creado escritos para este caso.
          </p>
          <Button
            variant="outline"
            onClick={() => setIsDialogOpen(true)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Crear primer escrito
          </Button>
        </CardContent>
      </Card>

      <CreateEscritoDialog open={isDialogOpen} setOpen={setIsDialogOpen} />
    </>
  );
}