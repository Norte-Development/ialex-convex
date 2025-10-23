import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Skeleton para DataBasePage
 * Muestra el estado de carga de la página de base de datos legislativa
 */
export function DataBasePageSkeleton() {
  return (
    <div className="w-full flex justify-center items-center">
      <section className="w-[70%] h-full min-h-screen mt-18 justify-center items-center bg-white flex py-5 px-5 flex-col gap-5">
        <Card>
          <CardHeader>
            {/* Title and view toggle buttons */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-7 w-64" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-32" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search bar and filters section */}
            <div className="space-y-4">
              {/* Search input */}
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-24" />
              </div>

              {/* Jurisdiction selector and filter button */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-32" />
              </div>

              {/* Active filters badges */}
              <div className="flex gap-2 flex-wrap">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-28" />
              </div>

              {/* Table skeleton */}
              <div className="border rounded-lg">
                {/* Table header */}
                <div className="border-b bg-muted/50 p-4">
                  <div className="grid grid-cols-12 gap-4">
                    <Skeleton className="h-5 col-span-3" />
                    <Skeleton className="h-5 col-span-2" />
                    <Skeleton className="h-5 col-span-2" />
                    <Skeleton className="h-5 col-span-2" />
                    <Skeleton className="h-5 col-span-2" />
                    <Skeleton className="h-5 col-span-1" />
                  </div>
                </div>

                {/* Table rows */}
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="border-b p-4 last:border-b-0">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-3 space-y-1">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                      <Skeleton className="h-4 col-span-2" />
                      <Skeleton className="h-4 col-span-2" />
                      <Skeleton className="h-4 col-span-2" />
                      <Skeleton className="h-4 col-span-2" />
                      <Skeleton className="h-8 w-20 col-span-1" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-9 w-24" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
