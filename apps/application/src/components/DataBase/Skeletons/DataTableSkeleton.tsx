import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton específico para la tabla de datos de normativas
 * Se muestra mientras se cargan los datos de la tabla
 */
export function DataTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Table container */}
      <div className="border rounded-lg">
        {/* Table header */}
        <div className="border-b bg-muted/50 p-4">
          <div className="grid grid-cols-12 gap-4">
            <Skeleton className="h-5 col-span-3" />
            <Skeleton className="h-5 col-span-2" />
            <Skeleton className="h-5 col-span-2" />
            <Skeleton className="h-5 col-span-2" />
            <Skeleton className="h-5 col-span-2" />
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
  );
}
