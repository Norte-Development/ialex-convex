import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton para ExistingUserHome
 * Muestra el estado de carga de los casos recientes y eventos próximos
 */
export function ExistingUserHomeSkeleton() {
  return (
    <>
      <div className="grid lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-10"></div>
      <div className="flex flex-col justify-center items-start w-full">
        <Skeleton className="h-5 w-[350px] mb-5" />

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full gap-4 mb-10">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border rounded-lg p-6 space-y-3 bg-white hover:shadow-md transition-shadow"
            >
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-8 mb-10 mt-10">
          <div className="flex flex-col justify-start items-start gap-4">
            <Skeleton className="h-5 w-[250px]" />
            <Skeleton className="h-10 w-[150px] rounded-md" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3 bg-white">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
