import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface MenuOption {
  label: string;
  path: string;
}

interface CollapsibleMenuButtonProps {
  options: MenuOption[];
  label?: string;
}

export default function CollapsibleMenuButton({
  options,
  label = "Menu",
}: CollapsibleMenuButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="relative">
      <CollapsibleTrigger className="text-[#1868D8] cursor-pointer justify-center items-center text-[15px] px-2 py-1 flex gap-1 border-1 border-[#1868D8] rounded-md hover:bg-blue-50 transition-colors">
        {label}{" "}
        <ChevronDown
          size={15}
          className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="absolute top-full -right-20 mt-2 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2">
        <div className="bg-white border border-gray-200  rounded-lg shadow-lg overflow-hidden min-w-[160px]">
          {options.map((option) => (
            <div className="flex w-full mt-3">
              <div className="bg-[#1868D8] w-2 h-[40px] rounded-r-2xl" />
              <Link
                key={option.path}
                to={option.path}
                className="block px-4  py-2.5 text-sm w-full text-gray-700 hover:bg-blue-50 hover:text-[#1868D8] transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {option.label}
              </Link>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
