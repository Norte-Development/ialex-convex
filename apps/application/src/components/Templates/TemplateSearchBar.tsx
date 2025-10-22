import { Input } from "@/components/ui/input";
import { CirclePlus, Search } from "lucide-react";
import { Button } from "../ui/button";

interface TemplateSearchBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAddTemplate: () => void;
}

export function TemplateSearchBar({
  searchValue,
  onSearchChange,
  onAddTemplate,
}: TemplateSearchBarProps) {
  return (
    <div className="flex gap-2 w-full pl-2 justify-between ">
      <div className="flex relative w-[35%] h-[25px] ">
        <Input
          placeholder="Buscar por palabra clave"
          className="bg-white border border-gray-300 p-2 h-full w-full placeholder:text-sm "
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <Search size={16} className="absolute right-2 top-1 text-gray-400" />
      </div>
      <Button
        className=" rounded-lg py-0 px-1 flex cursor-pointer"
        onClick={onAddTemplate}
      >
        Añadir
        <CirclePlus size={15} className="text-white" />
      </Button>
    </div>
  );
}
