import CaseCards from "./CaseCards";
import { Input } from "@/components/ui/input";
import ClientTable from "./ClientTable";
import { useState } from "react";

const ExistingUserHome = () => {
  const [search, setSearch] = useState("");
  return (
    <>
      <div className="grid lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1  gap-10 ">
        <CaseCards name="Caso 1" />
        <CaseCards name="Caso 2" />
        <CaseCards name="Caso 3" />
      </div>
      <div className="w-full flex justify-start items-center">
        <Input
          placeholder="Busca tu cliente por dni, CUIT, nombre..."
          className="lg:w-1/2 w-full bg-[#f7f7f7]"
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <ClientTable search={search} />

      <div className="w-full min-h-[200px] flex justify-start bg-[#f7f7f7] rounded-lg p-4">
        <p className="font-bold text-xl">Proximos eventos</p>
      </div>
    </>
  );
};

export default ExistingUserHome;
