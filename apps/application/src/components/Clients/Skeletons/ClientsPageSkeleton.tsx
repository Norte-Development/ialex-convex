import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton para ClientsPage
 * Muestra el estado de carga de la página de clientes
 */
export function ClientsPageSkeleton() {
  return (
    <div className="w-full flex justify-center items-center">
      <div className="flex flex-col gap-4 w-[70%] bg-white h-full pt-20 min-h-screen px-10">
        {/* Search bar and create button */}
        <div className="w-full flex justify-between items-center">
          <Skeleton className="h-6 w-[40%]" />
          <Skeleton className="h-9 w-32" />
        </div>

        {/* Table */}
        <div className="w-full flex justify-start rounded-lg">
          <div className="border border-gray-300 rounded-lg overflow-hidden w-full">
            {/* Table header */}
            <div className="border-b bg-muted/50 p-4">
              <div className="flex gap-4 items-center">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>

            {/* Table rows */}
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="border-b p-4 last:border-b-0">
                <div className="flex gap-4 items-center">
                  <Skeleton className="h-4 w-4" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-24 ml-auto" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
