import { useState, useEffect } from "react";
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
  { name: "Arial", value: "Arial, sans-serif" },
  { name: "Calibri", value: "Calibri, sans-serif" },
  { name: "Times New Roman", value: "Times New Roman, serif" },
  { name: "Georgia", value: "Georgia, serif" },
  { name: "Verdana", value: "Verdana, sans-serif" },
  { name: "Courier New", value: "Courier New, monospace" },
  { name: "Comic Sans MS", value: "Comic Sans MS, cursive" },
  { name: "Trebuchet MS", value: "Trebuchet MS, sans-serif" },
  { name: "Garamond", value: "Garamond, serif" },
];

export function FontPicker({ editor }: FontPickerProps) {
  const [selectedFont, setSelectedFont] = useState("Arial");

  useEffect(() => {
    const updateFont = () => {
      const { fontFamily } = editor.getAttributes("textStyle");
      if (fontFamily) {
        // Extract font name from the full value (e.g., "Arial, sans-serif" -> "Arial")
        const fontName = fontFamily.split(",")[0].replace(/['"]/g, "").trim();
        const matchedFont = FONTS.find((f) => f.value.startsWith(fontName));
        if (matchedFont) {
          setSelectedFont(matchedFont.name);
        }
      } else {
        setSelectedFont("Arial");
      }
    };

    // Update on selection change
    editor.on("selectionUpdate", updateFont);
    editor.on("transaction", updateFont);

    // Initial update
    updateFont();

    return () => {
      editor.off("selectionUpdate", updateFont);
      editor.off("transaction", updateFont);
    };
  }, [editor]);

  const handleFontChange = (font: { name: string; value: string }) => {
    setSelectedFont(font.name);
    editor.chain().focus().setFontFamily(font.value).run();
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
      <DropdownMenuContent
        align="start"
        className="w-[180px] max-h-[300px] overflow-y-auto"
      >
        {FONTS.map((font) => (
          <DropdownMenuItem
            key={font.value}
            onClick={() => handleFontChange(font)}
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
