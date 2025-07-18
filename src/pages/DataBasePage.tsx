import ConditionalLayout from "@/components/Layout/ConditionalLayout";
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
import { useLayout } from "@/context/LayoutContext";
import { useState } from "react";

export default function DataBasePage() {
  const { isInCaseContext } = useLayout();

  const [category, setCategory] = useState("ley");

  return (
    <ConditionalLayout>
      <section
        className={`w-full h-full flex pl-5 ${isInCaseContext ? "pt-5" : "pt-20"} flex-col gap-5 pr-5`}
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
    </ConditionalLayout>
  );
}
