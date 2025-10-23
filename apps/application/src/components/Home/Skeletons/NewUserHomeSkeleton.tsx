import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton para NewUserHome
 * Muestra el estado de carga de los quick actions y tips para nuevos usuarios
 */
export function NewUserHomeSkeleton() {
  return (
    <div className="flex w-full gap-6 lg:gap-10">
      <div className="w-1/2 flex flex-col justify-center">
        <Skeleton className="h-7 w-[150px] mb-4" />

        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-[#f7f7f7] rounded-md px-3 py-3 border border-border"
            >
              <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          ))}
        </div>
      </div>

      <div className="w-1/2 flex flex-col justify-center">
        <Skeleton className="h-7 w-[250px] mb-4" />

        {/* Tips list */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-2 items-start">
              <Skeleton className="h-2 w-2 rounded-full mt-2 flex-shrink-0" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-4">
          <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
          <Skeleton className="h-4 w-[300px]" />
        </div>
      </div>
    </div>
  );
}
