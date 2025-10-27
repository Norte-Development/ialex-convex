import { Skeleton } from "@/components/ui/skeleton";

export function DocumentsListSkeleton() {
  return (
    <div className="w-full flex flex-col min-h-[70vh] justify-between">
      {/* Action buttons */}
      <div className="px-6 py-4   justify-between flex gap-2 border-b">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-5 w-82" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 px-6">
        <div className="border rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="bg-gray-50 border-b">
            <div className="flex items-center px-4 py-3">
              <div className="w-12">
                <Skeleton className="h-4 w-4" />
              </div>
              <div className="flex-1 flex items-center gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-4" />
              </div>
              <div className="w-32">
                <Skeleton className="h-4 w-12" />
              </div>
              <div className="w-40">
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="w-32">
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="w-16" />
            </div>
          </div>

          {/* Table Body - Folders */}
          {[1, 2].map((i) => (
            <div key={`folder-${i}`} className="border-b">
              <div className="flex items-center px-4 py-4 hover:bg-gray-50">
                <div className="w-12">
                  <Skeleton className="h-4 w-4" />
                </div>
                <div className="flex-1 flex items-center gap-3">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <div className="w-32">
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <div className="w-40">
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="w-32">
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="w-16">
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            </div>
          ))}

          {/* Table Body - Documents */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={`doc-${i}`} className="border-b last:border-b-0">
              <div className="flex items-center px-4 py-4 hover:bg-gray-50">
                <div className="w-12">
                  <Skeleton className="h-4 w-4" />
                </div>
                <div className="flex-1 flex items-center gap-3">
                  <Skeleton className="h-5 w-5" />
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <div className="w-32">
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="w-40">
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="w-32">
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="w-16 flex gap-2">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      <div className="px-6 pb-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}
