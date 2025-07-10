import CaseDetailLayout from "@/components/Layout/CaseDetailLayout";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import ClientsTable from "@/components/Clients/ClientsTable";
export default function ClientsPage() {
  const [search, setSearch] = useState("");
  return (
    <CaseDetailLayout>
      <div className="flex flex-col gap-4 w-full h-full pl-10 pt-2">
        <div className="max-w-xl flex flex-col justify-start items-center">
          <Input
            onChange={(e) => setSearch(e.target.value)}
            className="p-0 text-sm h-6 bg-white"
          />
        </div>

        <div className="w-full  max-w-4xl flex justify-start  rounded-lg ">
          <ClientsTable search={search} />
        </div>
      </div>
    </CaseDetailLayout>
  );
}
