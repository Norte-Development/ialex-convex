import { Skeleton } from "@/components/ui/skeleton";

export function CasesPageSkeleton() {
  return (
    <div className="flex flex-col gap-4 w-full min-h-screen px-5 pt-20">
      {/* Header con título y botón */}
      <div className="w-full flex justify-between items-center">
        <Skeleton className="h-8 w-32" />
        <div className="flex items-center gap-4">
          {/* Usage Meter */}
          <div className="w-64">
            <Skeleton className="h-8 w-full" />
          </div>
          {/* Create Case Button */}
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Table */}
      <div className="w-full flex justify-start">
        <CaseTableSkeleton />
      </div>
    </div>
  );
}

function CaseTableSkeleton() {
  return (
    <div className="space-y-4 w-full">
      {/* Tabla de casos */}
      <div className="w-full border rounded-lg">
        {/* Table Header */}
        <div className="bg-gray-100 py-4 px-2 border-b">
          <div className="flex items-center">
            {/* Checkbox */}
            <div className="w-12 flex justify-center">
              <Skeleton className="h-5 w-5" />
            </div>
            {/* Casos */}
            <div className="flex-1 text-center">
              <Skeleton className="h-4 w-16 mx-auto" />
            </div>
            {/* Estado */}
            <div className="flex-1 text-center">
              <Skeleton className="h-4 w-16 mx-auto" />
            </div>
            {/* Equipos */}
            <div className="flex-1 text-center">
              <Skeleton className="h-4 w-16 mx-auto" />
            </div>
            {/* Miembros */}
            <div className="flex-1 text-center">
              <Skeleton className="h-4 w-20 mx-auto" />
            </div>
          </div>
        </div>

        {/* Table Body - 5 rows */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="border-b last:border-b-0">
            <div className="flex items-center py-4 px-2">
              {/* Checkbox */}
              <div className="w-12 flex justify-center">
                <Skeleton className="h-5 w-5" />
              </div>
              {/* Nombre del caso */}
              <div className="flex-1 px-4">
                <Skeleton className="h-4 w-48" />
              </div>
              {/* Badge Estado */}
              <div className="flex-1 flex justify-center">
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              {/* Equipos - Avatars */}
              <div className="flex-1 flex justify-center items-center gap-1">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
              {/* Miembros - Avatars */}
              <div className="flex-1 flex justify-center items-center gap-1">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
