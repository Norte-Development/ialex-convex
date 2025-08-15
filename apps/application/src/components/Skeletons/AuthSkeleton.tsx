import { Skeleton } from "@/components/ui/skeleton";

export const AuthSkeleton = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo/Title skeleton */}
        <div className="text-center mb-8">
          <Skeleton className="h-9 w-20 mx-auto mb-2" />
          <Skeleton className="h-5 w-48 mx-auto" />
        </div>

        {/* Form skeleton */}
        <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>

          <Skeleton className="h-10 w-full" />
          
          <div className="text-center space-y-2">
            <Skeleton className="h-4 w-32 mx-auto" />
            <Skeleton className="h-4 w-24 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}; 