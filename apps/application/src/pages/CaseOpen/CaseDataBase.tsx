import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DataBaseTable from "@/components/DataBase/DataBaseTable";
import { useState } from "react";
import CaseLayout from "@/components/Cases/CaseLayout";

export default function CaseDataBasePage() {
  const [category, setCategory] = useState("ley");

  return (
    <CaseLayout>
      <section
        className={`w-full h-full bg-white flex pt-5  flex-col gap-5 px-5`}
      >
        <div className="flex gap-2">
          <Input
            placeholder="buscar palabra clave"
            className="bg-gray-200 p-1 w-[30%]"
          />
          <Select onValueChange={setCategory}>
            <SelectTrigger className="w-[30%] text-sm" size="sm">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ley">Ley</SelectItem>
                <SelectItem value="reglamento">Reglamento</SelectItem>
                <SelectItem value="decreto">Decreto</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <DataBaseTable category={category} />
      </section>
    </CaseLayout>
  );
}
