import { Skeleton } from "@/components/ui/skeleton";

export const AppSkeleton = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation skeleton */}
      <nav className="flex justify-between items-center h-14 w-full bg-background border-b border-border fixed top-0 left-0 z-50 px-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-5 rounded" />
        </div>
      </nav>

      {/* Main content skeleton */}
      <div className="pt-20 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Welcome message skeleton */}
          <div className="text-center mb-8">
            <Skeleton className="h-12 w-96 mx-auto mb-6" />
            <Skeleton className="h-24 w-full max-w-2xl mx-auto rounded-lg" />
          </div>

          {/* Cards grid skeleton */}
          <div className="grid lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-10 mb-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border p-4 space-y-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>

          {/* Search input skeleton */}
          <div className="w-full flex justify-start items-center mb-6">
            <Skeleton className="h-10 w-1/2" />
          </div>

          {/* Table skeleton */}
          <div className="bg-white rounded-lg border">
            <div className="border-b p-4">
              <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-28" />
              </div>
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="border-b p-4 last:border-b-0">
                <div className="grid grid-cols-3 gap-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>

          {/* Events section skeleton */}
          <div className="w-full min-h-[200px] bg-gray-50 rounded-lg p-4 mt-8">
            <Skeleton className="h-6 w-40 mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 