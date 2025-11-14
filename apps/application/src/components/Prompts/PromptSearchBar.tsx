import { Input } from "@/components/ui/input";
import { CirclePlus, Search } from "lucide-react";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PromptSearchBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAddPrompt: () => void;
  selectedCategory?: string;
  onCategoryChange: (category: string) => void;
  categories: string[];
}

export function PromptSearchBar({
  searchValue,
  onSearchChange,
  onAddPrompt,
  selectedCategory,
  onCategoryChange,
  categories,
}: PromptSearchBarProps) {
  return (
    <div className="flex gap-2 w-full p-4 justify-between items-center bg-white border-b">
      <div className="flex gap-2 flex-1">
        <div className="flex relative w-[400px] h-9">
          <Input
            placeholder="Buscar prompts por título..."
            className="bg-white border border-gray-300 p-2 h-full w-full placeholder:text-sm"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <Search
            size={16}
            className="absolute right-3 top-2.5 text-gray-400"
          />
        </div>

        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        className="rounded-lg h-9 px-4 flex gap-2 cursor-pointer"
        onClick={onAddPrompt}
      >
        Añadir Prompt
        <CirclePlus size={16} className="text-white" />
      </Button>
    </div>
  );
}
