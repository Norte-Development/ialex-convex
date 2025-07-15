import CaseDetailLayout from "@/components/Layout/CaseDetailLayout";
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

export default function DataBasePage() {
  return (
    <CaseDetailLayout>
      <section className="w-full h-full flex pl-5 pt-5 flex-col gap-10 pr-5">
        <div className="flex gap-2">
          <Input
            placeholder="buscar palabra clave"
            className="bg-gray-200 p-1 w-[30%]"
          />
          <Select>
            <SelectTrigger className="w-[30%] text-sm" size="sm">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="1">
                  Procesamiento de Lenguaje Natural
                </SelectItem>
                <SelectItem value="2">Análisis Predictivo</SelectItem>
                <SelectItem value="3">Clustering</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <DataBaseTable />
      </section>
    </CaseDetailLayout>
  );
}
