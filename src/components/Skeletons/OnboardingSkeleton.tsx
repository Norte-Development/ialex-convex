import { Skeleton } from "@/components/ui/skeleton";

export const OnboardingSkeleton = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        {/* Progress indicator skeleton */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {[1, 2, 3, 4].map((step) => (
              <Skeleton
                key={step}
                className="w-8 h-8 rounded-full"
              />
            ))}
          </div>
          <Skeleton className="w-full h-2 rounded-full" />
        </div>

        {/* Content skeleton */}
        <div className="space-y-6">
          {/* Title and description */}
          <div className="text-center space-y-2">
            <Skeleton className="h-8 w-64 mx-auto" />
            <Skeleton className="h-5 w-80 mx-auto" />
          </div>
          
          {/* Form content skeleton */}
          <div className="space-y-4">
            <div>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
            
            <div>
              <Skeleton className="h-4 w-40 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>

            {/* Grid of items (like specializations) */}
            <div className="grid grid-cols-2 gap-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>

            {/* Textarea skeleton */}
            <div>
              <Skeleton className="h-4 w-36 mb-2" />
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-3 w-24 mt-1" />
            </div>
          </div>
        </div>

        {/* Navigation buttons skeleton */}
        <div className="flex justify-between mt-8">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    </div>
  );
}; 