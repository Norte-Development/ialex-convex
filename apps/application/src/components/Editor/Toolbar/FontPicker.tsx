import { useState } from "react";
import type { Editor } from "@tiptap/core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

interface FontPickerProps {
  editor: Editor;
}

const FONTS = [
  { name: "Calibri", value: "Calibri, sans-serif" },
  { name: "Arial", value: "Arial, sans-serif" },
  { name: "Times New Roman", value: "'Times New Roman', serif" },
  { name: "Georgia", value: "Georgia, serif" },
  { name: "Verdana", value: "Verdana, sans-serif" },
  { name: "Courier New", value: "'Courier New', monospace" },
  { name: "Comic Sans MS", value: "'Comic Sans MS', cursive" },
];

export function FontPicker({ editor }: FontPickerProps) {
  const [selectedFont, setSelectedFont] = useState("Calibri");

  const handleFontChange = (fontName: string, fontValue: string) => {
    setSelectedFont(fontName);
    // Note: This would require a custom extension to fully implement
    // For now, this is a UI placeholder
    editor.chain().focus().run();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs justify-between min-w-[120px] hover:bg-office-hover"
        >
          <span className="truncate">{selectedFont}</span>
          <ChevronDown className="h-3 w-3 ml-1 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[180px]">
        {FONTS.map((font) => (
          <DropdownMenuItem
            key={font.value}
            onClick={() => handleFontChange(font.name, font.value)}
            className="cursor-pointer"
            style={{ fontFamily: font.value }}
          >
            {font.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

