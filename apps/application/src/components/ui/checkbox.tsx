import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon, Square } from "lucide-react";

import { cn } from "@/lib/utils";

interface CheckboxProps
  extends React.ComponentProps<typeof CheckboxPrimitive.Root> {
  indeterminate?: boolean;
}

function Checkbox({
  className,
  indeterminate = false,
  checked,
  ...props
}: CheckboxProps) {
  // Determinar el estado del checkbox
  const checkboxState = indeterminate ? "indeterminate" : checked;

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer cursor-pointer border-input data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary hover:border-primary aria-invalid:ring-destructive/20 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        // Estilos para estado indeterminado
        indeterminate &&
          "bg-primary cursor-default text-primary-foreground border-primary",
        className,
      )}
      checked={checkboxState}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        {indeterminate ? (
          <Square fill="#5bb6e5" className="size-3.5" />
        ) : (
          <CheckIcon className="size-3.5" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
