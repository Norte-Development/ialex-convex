import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible";
import { Link } from "react-router-dom";
import { ChevronDown, LucideIcon } from "lucide-react";
import { useState } from "react";

interface MenuOption {
  label: string;
  path: string;
  icon: LucideIcon;
}

interface CollapsibleMenuButtonProps {
  options: MenuOption[];
  label?: string;
  open?: boolean;
}

export default function CollapsibleMenuButton({
  options,
  label = "Menú",
  open = false,
}: CollapsibleMenuButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible
      open={open || isOpen}
      onOpenChange={setIsOpen}
      className="relative"
    >
      <CollapsibleTrigger
        data-tutorial="home-menu"
        className="text-[#1868D8] cursor-pointer justify-center items-center text-[15px] px-2 py-1 flex gap-1 border-1 border-[#1868D8] rounded-md hover:bg-blue-50 transition-colors"
      >
        {label}{" "}
        <ChevronDown
          size={15}
          className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="absolute top-full -right-30 mt-2 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2">
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-[200px]">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <Link
                key={option.path}
                to={option.path}
                data-tutorial={
                  option.label === "Casos" ? "nav-cases" : undefined
                }
                className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-blue-50/50 hover:text-[#1868D8] transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span>{option.label}</span>
              </Link>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
