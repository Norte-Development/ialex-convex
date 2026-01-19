import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface TemplateSearchBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
}

export function TemplateSearchBar({
  searchValue,
  onSearchChange,
}: TemplateSearchBarProps) {
  return (
    <div className="flex gap-2 w-full pl-2 justify-start">
      <div className="flex relative w-[35%] h-[25px]">
        <Input
          placeholder="Buscar por palabra clave"
          className="bg-white border border-gray-300 p-2 h-full w-full placeholder:text-sm"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <Search size={16} className="absolute right-2 top-1 text-gray-400" />
      </div>
    </div>
  );
}
