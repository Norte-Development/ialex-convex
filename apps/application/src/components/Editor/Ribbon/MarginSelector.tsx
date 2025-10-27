import { useState } from "react";
// @ts-ignore - TypeScript cache issue with @tiptap/core types
import type { Editor } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Ruler } from "lucide-react";

interface MarginSelectorProps {
  editor: Editor;
}

export function MarginSelector({ editor }: MarginSelectorProps) {
  const [margins, setMargins] = useState({
    top: "0px",
    bottom: "0px",
    left: "0px",
    right: "0px",
  });

  const applyMargins = () => {
    editor
      .chain()
      .focus()
      .setMargin({
        top: margins.top,
        bottom: margins.bottom,
        left: margins.right,
        right: margins.left,
      })
      .run();
  };

  const applyPreset = (preset: {
    top: string;
    bottom: string;
    left: string;
    right: string;
  }) => {
    setMargins(preset);
    editor
      .chain()
      .focus()
      .setMargin({
        top: preset.top,
        bottom: preset.bottom,
        left: preset.right,
        right: preset.left,
      })
      .run();
  };

  const presets = [
    {
      name: "Normal",
      values: { top: "20px", bottom: "20px", left: "30px", right: "30px" },
    },
    {
      name: "Estrecho",
      values: { top: "10px", bottom: "10px", left: "15px", right: "15px" },
    },
    {
      name: "Ancho",
      values: { top: "30px", bottom: "30px", left: "40px", right: "40px" },
    },
    {
      name: "Sin margen",
      values: { top: "0px", bottom: "0px", left: "0px", right: "0px" },
    },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex flex-col items-center gap-1 h-auto py-2 px-3 hover:bg-office-hover"
          title="Márgenes"
        >
          <Ruler className="h-6 w-6" />
          <span className="text-xs">Márgenes</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm mb-3">Márgenes del párrafo</h4>

            {/* Preset buttons */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {presets.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(preset.values)}
                  className="text-xs"
                >
                  {preset.name}
                </Button>
              ))}
            </div>

            {/* Custom margin inputs */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="margin-top" className="text-xs">
                    Superior
                  </Label>
                  <Input
                    id="margin-top"
                    type="text"
                    value={margins.top}
                    onChange={(e) =>
                      setMargins({ ...margins, top: e.target.value })
                    }
                    placeholder="0px"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="margin-bottom" className="text-xs">
                    Inferior
                  </Label>
                  <Input
                    id="margin-bottom"
                    type="text"
                    value={margins.bottom}
                    onChange={(e) =>
                      setMargins({ ...margins, bottom: e.target.value })
                    }
                    placeholder="0px"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="margin-left" className="text-xs">
                    Izquierda
                  </Label>
                  <Input
                    id="margin-left"
                    type="text"
                    value={margins.left}
                    onChange={(e) =>
                      setMargins({ ...margins, left: e.target.value })
                    }
                    placeholder="0px"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="margin-right" className="text-xs">
                    Derecha
                  </Label>
                  <Input
                    id="margin-right"
                    type="text"
                    value={margins.right}
                    onChange={(e) =>
                      setMargins({ ...margins, right: e.target.value })
                    }
                    placeholder="0px"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <Button onClick={applyMargins} className="w-full" size="sm">
                Aplicar márgenes personalizados
              </Button>

              <p className="text-xs text-muted-foreground">
                Usa unidades CSS: px, em, rem, %, etc.
              </p>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
