import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton para la página de inicio (HomePage)
 * Se muestra mientras se carga el lazy component completo
 * Replica exactamente la estructura visual de HomePage
 */
export function HomePageSkeleton() {
  return (
    <section className="flex flex-col min-h-screen w-full overflow-y-hidden bg-white justify-center items-center relative pt-20">
      <div className="w-3/4 flex flex-col gap-8 items-center justify-center">
        {/* Header section */}
        <div className="flex flex-col gap-8 w-full justify-center items-center">
          {/* Title skeleton - "¡Buenos días, [nombre]!" y "¿En qué trabajamos hoy?" */}
          <div className="flex flex-col items-center justify-center gap-0">
            <Skeleton className="h-[54px] w-[500px] mb-2" />
            <Skeleton className="h-[54px] w-[450px]" />
          </div>

          {/* Subtitle skeleton - "Comience el día con ayuda de su asistente IA" */}
          <Skeleton className="h-7 w-[450px] mt-10" />

          {/* Textarea skeleton */}
          <div className="relative w-full max-w-4xl h-fit mx-auto">
            <Skeleton className="h-[60px] w-full rounded-[17px]" />
          </div>
        </div>

        {/* Content skeleton - replica ExistingUserHome structure */}
        <div className="flex flex-col justify-center items-start w-full">
          {/* "O acceda a los casos..." text */}
          <Skeleton className="h-5 w-[350px] mb-5" />

          {/* Cases grid */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full gap-4 mb-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-lg p-6 space-y-3 bg-white">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex items-center justify-between pt-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              </div>
            ))}
          </div>

          {/* Events section */}
          <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-8 mb-10 mt-10">
            {/* Left column */}
            <div className="flex flex-col justify-start items-start gap-4">
              <Skeleton className="h-5 w-[250px]" />
              <Skeleton className="h-10 w-[150px] rounded-md" />
            </div>

            {/* Right column - Events grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="border rounded-lg p-4 space-y-3 bg-white"
                >
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
