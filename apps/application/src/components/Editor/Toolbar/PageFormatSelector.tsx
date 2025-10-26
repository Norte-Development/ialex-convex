import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PageFormatPx, PageFormatId, BUILT_IN_FORMATS } from "../../../../../../packages/shared/src/tiptap/pageFormat";
import { FileText } from "lucide-react";
import { PageFormatModal } from "../Toolbar/PageFormatModal";

interface PageFormatSelectorProps {
  currentFormat: PageFormatPx;
  onFormatChange: (format: PageFormatPx) => void;
}

export function PageFormatSelector({
  currentFormat,
  onFormatChange,
}: PageFormatSelectorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const builtInIds: Array<Exclude<PageFormatId, 'Custom'>> = ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid'];

  const handleSelectFormat = (formatId: Exclude<PageFormatId, 'Custom'>) => {
    onFormatChange(BUILT_IN_FORMATS[formatId]);
  };

  const handleCustomFormat = (format: PageFormatPx) => {
    onFormatChange(format);
    setIsModalOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="text-sm">
              {currentFormat.id}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {builtInIds.map((id) => (
            <DropdownMenuItem
              key={id}
              onClick={() => handleSelectFormat(id)}
              className={currentFormat.id === id ? "bg-accent" : ""}
            >
              {id}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsModalOpen(true)}>
            Custom...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PageFormatModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentFormat={currentFormat}
        onApply={handleCustomFormat}
      />
    </>
  );
}

