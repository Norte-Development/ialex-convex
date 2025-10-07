import { useState } from "react";
import type { Editor } from "@tiptap/core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Palette } from "lucide-react";

interface ColorPickerProps {
  editor: Editor;
}

const OFFICE_COLORS = [
  // Theme Colors
  ["#000000", "#FFFFFF", "#E7E6E6", "#44546A", "#5B9BD5", "#ED7D31", "#A5A5A5", "#FFC000", "#4472C4", "#70AD47"],
  // Lighter shades
  ["#7F7F7F", "#D0CECE", "#C9C9C9", "#D6DCE4", "#DEEBF6", "#FCE4D6", "#EDEDED", "#FFF2CC", "#D9E2F3", "#E2EFD9"],
  // Medium shades
  ["#595959", "#AEAAAA", "#A6A6A6", "#ADB9CA", "#BDD7EE", "#F8CBAD", "#DBDBDB", "#FFE699", "#B4C7E7", "#C5E0B3"],
  // Darker shades
  ["#3F3F3F", "#757070", "#7B7B7B", "#8496B0", "#9BC2E6", "#F4B083", "#C9C9C9", "#FFD966", "#8FAADC", "#A8D08D"],
  ["#262626", "#3A3838", "#525252", "#323E4F", "#2E75B5", "#C55A11", "#7B7B7B", "#BF8F00", "#305496", "#538135"],
];

export function ColorPicker({ editor }: ColorPickerProps) {
  const [selectedColor, setSelectedColor] = useState("#000000");

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    editor.chain().focus().setColor(color).run();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-office-hover relative"
          title="Color de fuente"
        >
          <Palette className="h-4 w-4" />
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-4"
            style={{ backgroundColor: selectedColor }}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px] p-2">
        <div className="space-y-1">
          <div className="text-xs font-medium mb-2">Colores del tema</div>
          {OFFICE_COLORS.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-1">
              {row.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorChange(color)}
                  className="w-6 h-6 rounded border border-gray-300 hover:border-gray-500 transition-colors"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

