import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PageFormatPx,
  PageMarginsPx,
  createCustomPageFormat,
  pixelsToCm,
  cmToPixels,
} from "../../../../../../packages/shared/src/tiptap/pageFormat";

interface PageFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFormat: PageFormatPx;
  onApply: (format: PageFormatPx) => void;
}

type Unit = "cm" | "px";

export function PageFormatModal({
  isOpen,
  onClose,
  currentFormat,
  onApply,
}: PageFormatModalProps) {
  const [unit, setUnit] = useState<Unit>("cm");
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [marginTop, setMarginTop] = useState<string>("");
  const [marginRight, setMarginRight] = useState<string>("");
  const [marginBottom, setMarginBottom] = useState<string>("");
  const [marginLeft, setMarginLeft] = useState<string>("");

  // Initialize form with current format
  useEffect(() => {
    if (isOpen) {
      if (unit === "cm") {
        setWidth(pixelsToCm(currentFormat.width).toString());
        setHeight(pixelsToCm(currentFormat.height).toString());
        setMarginTop(pixelsToCm(currentFormat.margins.top).toString());
        setMarginRight(pixelsToCm(currentFormat.margins.right).toString());
        setMarginBottom(pixelsToCm(currentFormat.margins.bottom).toString());
        setMarginLeft(pixelsToCm(currentFormat.margins.left).toString());
      } else {
        setWidth(currentFormat.width.toString());
        setHeight(currentFormat.height.toString());
        setMarginTop(currentFormat.margins.top.toString());
        setMarginRight(currentFormat.margins.right.toString());
        setMarginBottom(currentFormat.margins.bottom.toString());
        setMarginLeft(currentFormat.margins.left.toString());
      }
    }
  }, [isOpen, currentFormat, unit]);

  const handleApply = () => {
    const widthPx = unit === "cm" ? cmToPixels(parseFloat(width)) : parseFloat(width);
    const heightPx = unit === "cm" ? cmToPixels(parseFloat(height)) : parseFloat(height);
    const margins: PageMarginsPx = {
      top: unit === "cm" ? cmToPixels(parseFloat(marginTop)) : parseFloat(marginTop),
      right: unit === "cm" ? cmToPixels(parseFloat(marginRight)) : parseFloat(marginRight),
      bottom: unit === "cm" ? cmToPixels(parseFloat(marginBottom)) : parseFloat(marginBottom),
      left: unit === "cm" ? cmToPixels(parseFloat(marginLeft)) : parseFloat(marginLeft),
    };

    const customFormat = createCustomPageFormat(widthPx, heightPx, margins);
    onApply(customFormat);
  };

  const isValid = () => {
    const values = [width, height, marginTop, marginRight, marginBottom, marginLeft];
    return values.every((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Custom Page Format</DialogTitle>
          <DialogDescription>
            Set custom dimensions and margins for your document.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={unit} onValueChange={(v) => setUnit(v as Unit)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cm">Centimeters</TabsTrigger>
            <TabsTrigger value="px">Pixels</TabsTrigger>
          </TabsList>

          <TabsContent value={unit} className="space-y-4 mt-4">
            {/* Page Dimensions */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Page Dimensions</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="width">Width ({unit})</Label>
                  <Input
                    id="width"
                    type="number"
                    step="0.1"
                    min="0"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height ({unit})</Label>
                  <Input
                    id="height"
                    type="number"
                    step="0.1"
                    min="0"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Margins */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Margins</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="marginTop">Top ({unit})</Label>
                  <Input
                    id="marginTop"
                    type="number"
                    step="0.1"
                    min="0"
                    value={marginTop}
                    onChange={(e) => setMarginTop(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="marginRight">Right ({unit})</Label>
                  <Input
                    id="marginRight"
                    type="number"
                    step="0.1"
                    min="0"
                    value={marginRight}
                    onChange={(e) => setMarginRight(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="marginBottom">Bottom ({unit})</Label>
                  <Input
                    id="marginBottom"
                    type="number"
                    step="0.1"
                    min="0"
                    value={marginBottom}
                    onChange={(e) => setMarginBottom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="marginLeft">Left ({unit})</Label>
                  <Input
                    id="marginLeft"
                    type="number"
                    step="0.1"
                    min="0"
                    value={marginLeft}
                    onChange={(e) => setMarginLeft(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!isValid()}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

