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

interface LineHeightPickerProps {
  editor: Editor;
}

const LINE_HEIGHTS = [
  { label: "1.0", value: "1" },
  { label: "1.15", value: "1.15" },
  { label: "1.5", value: "1.5" },
  { label: "1.75", value: "1.75" },
  { label: "2.0", value: "2" },
  { label: "2.5", value: "2.5" },
  { label: "3.0", value: "3" },
];

export function LineHeightPicker({ editor }: LineHeightPickerProps) {
  const [selectedHeight, setSelectedHeight] = useState("1.5");

  const handleHeightChange = (value: string) => {
    setSelectedHeight(value);
    editor.chain().focus().setLineHeight(value).run();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs justify-between min-w-[70px] hover:bg-office-hover"
          title="Altura de línea"
        >
          <span>{selectedHeight}</span>
          <ChevronDown className="h-3 w-3 ml-1 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[90px]">
        {LINE_HEIGHTS.map(({ label, value }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => handleHeightChange(value)}
            className="cursor-pointer text-sm"
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
