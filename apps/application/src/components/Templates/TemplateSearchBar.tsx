import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

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
    <div className="flex gap-2 w-[40%] pl-2">
      <Input
        placeholder="buscar palabra clave"
        className="bg-gray-200 p-1"
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <button 
        className="border-2 border-green-400 py-0 px-1 cursor-pointer"
        onClick={onAddTemplate}
      >
        <Plus size={20} className="text-green-400" />
      </button>
    </div>
  );
}
