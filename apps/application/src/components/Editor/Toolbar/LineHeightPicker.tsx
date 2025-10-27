import { type Editor } from "@tiptap/core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";

interface LineHeightPickerProps {
  editor: Editor;
}

const LINE_HEIGHTS = [
  { value: "1.0", label: "1.0" },
  { value: "1.15", label: "1.15" },
  { value: "1.5", label: "1.5" },
  { value: "2.0", label: "2.0" },
  { value: "2.5", label: "2.5" },
  { value: "3.0", label: "3.0" },
];

export function LineHeightPicker({ editor }: LineHeightPickerProps) {
  const [currentLineHeight, setCurrentLineHeight] = useState("1.5");

  useEffect(() => {
    const updateLineHeight = () => {
      // Get lineHeight from textStyle attributes
      const { lineHeight } = editor.getAttributes("textStyle");
      setCurrentLineHeight(lineHeight || "1.5");
    };

    // Update on selection change
    editor.on("selectionUpdate", updateLineHeight);
    editor.on("transaction", updateLineHeight);

    // Initial update
    updateLineHeight();

    return () => {
      editor.off("selectionUpdate", updateLineHeight);
      editor.off("transaction", updateLineHeight);
    };
  }, [editor]);

  const handleLineHeightChange = (value: string) => {
    editor.chain().focus().setLineHeight(value).run();
  };

  return (
    <Select value={currentLineHeight} onValueChange={handleLineHeightChange}>
      <SelectTrigger className="h-7 w-[70px] text-xs border-gray-300 hover:bg-office-hover focus:ring-1 focus:ring-blue-500">
        <SelectValue placeholder="1.5" />
      </SelectTrigger>
      <SelectContent>
        {LINE_HEIGHTS.map((height) => (
          <SelectItem
            key={height.value}
            value={height.value}
            className="text-xs"
          >
            {height.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
