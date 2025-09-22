import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { CircleIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const radioGroupItemVariants = cva(
  "group border-input cursor-pointer focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input",
  {
    variants: {
      variant: {
        default: "text-primary hover:border-primary",
        secondary: "text-[#023B58] hover:border-[#023B58]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const radioGroupIndicatorVariants = cva(
  "absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 group-disabled:fill-gray-500 group-disabled:text-gray-500",
  {
    variants: {
      variant: {
        default: "fill-primary",
        secondary: "fill-[#023B58]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  );
}

interface RadioGroupItemProps
  extends React.ComponentProps<typeof RadioGroupPrimitive.Item>,
    VariantProps<typeof radioGroupItemVariants> {}

function RadioGroupItem({ className, variant, ...props }: RadioGroupItemProps) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(radioGroupItemVariants({ variant }), className)}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="relative flex items-center justify-center"
      >
        <CircleIcon className={cn(radioGroupIndicatorVariants({ variant }))} />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
