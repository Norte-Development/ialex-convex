import { Skeleton } from "../ui/skeleton"

export function CaseTableSkeleton() {
  return (
    <div className="flex flex-col h-[calc(100vh-200px)] w-full">
      {/* Scrollable table container skeleton */}
      <div className="flex-1 overflow-auto border rounded-lg">
        <div className="border rounded-lg">
          {/* Header skeleton */}
          <div className="bg-gray-100 py-4 px-2 border-b">
            <div className="flex items-center gap-4">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          
          {/* Rows skeleton */}
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="p-2 border-b last:border-b-0">
              <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Fixed pagination skeleton at bottom */}
      <div className="mt-4 flex-shrink-0">
        <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
          <Skeleton className="h-4 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </div>
    </div>
  )
}
