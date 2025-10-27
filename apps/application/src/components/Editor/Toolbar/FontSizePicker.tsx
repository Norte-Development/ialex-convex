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

interface FontSizePickerProps {
  editor: Editor;
}

const FONT_SIZES = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72,
];

export function FontSizePicker({ editor }: FontSizePickerProps) {
  const [selectedSize, setSelectedSize] = useState("11");

  useEffect(() => {
    const updateFontSize = () => {
      // Get fontSize from textStyle attributes
      const { fontSize } = editor.getAttributes("textStyle");
      if (fontSize) {
        // Remove 'pt' or 'px' suffix if present
        const sizeValue = fontSize.replace(/pt|px/gi, "");
        setSelectedSize(sizeValue);
      } else {
        setSelectedSize("11");
      }
    };

    // Update on selection change
    editor.on("selectionUpdate", updateFontSize);
    editor.on("transaction", updateFontSize);

    // Initial update
    updateFontSize();

    return () => {
      editor.off("selectionUpdate", updateFontSize);
      editor.off("transaction", updateFontSize);
    };
  }, [editor]);

  const handleSizeChange = (size: number) => {
    editor.chain().focus().setFontSize(`${size}pt`).run();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs justify-between min-w-[60px] hover:bg-office-hover"
        >
          <span>{selectedSize}</span>
          <ChevronDown className="h-3 w-3 ml-1 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[80px]">
        {FONT_SIZES.map((size) => (
          <DropdownMenuItem
            key={size}
            onClick={() => handleSizeChange(size)}
            className="cursor-pointer text-sm"
          >
            {size}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
