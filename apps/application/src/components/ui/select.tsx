import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { getPortalContainer } from "@/lib/portalContainer";

const selectItemVariants = cva(
  "relative flex w-full cursor-pointer items-center gap-3 rounded-sm py-2.5 px-3 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors hover:bg-[#E8F0FE] data-[state=checked]:border-l-2 data-[state=checked]:border-l-blue-600",
  {
    variants: {
      variant: {
        default: "hover:border-primary ",
        tertiary: "hover:border-tertiary ",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const selectTriggerVariants = cva(
  "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground aria-invalid:ring-destructive/20 flex w-fit items-center justify-between gap-2 rounded-md border-2 bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow,background-color] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer disabled:bg-gray-200 disabled:text-gray-400 disabled:hover:border-input",
  {
    variants: {
      variant: {
        default: "",
        tertiary:
          "hover:border-tertiary [&:not([data-placeholder])]:bg-tertiary [&:not([data-placeholder])]:border-tertiary [&:not([data-placeholder])]:text-white [&:not([data-placeholder])]:[&_svg]:text-white",

        primary:
          "hover:border-primary [&:not([data-placeholder])]:bg-primary [&:not([data-placeholder])]:border-primary [&:not([data-placeholder])]:text-white [&:not([data-placeholder])]:[&_svg]:text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = "default",
  variant = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default";
  variant?: "default" | "tertiary";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(selectTriggerVariants({ variant }), className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 " />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal container={getPortalContainer()}>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          "bg-popover  text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-0",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  variant = "default",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item> & {
  variant?: "default" | "tertiary";
}) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(selectItemVariants({ variant }), className)}
      {...props}
    >
      {/* Radio button style indicator */}
      <div className="flex items-center justify-center w-5 h-5 relative">
        {/* Unselected state - empty circle (always rendered as base) */}
        <div className="w-5 h-5 rounded-full border-1 border-gray-200" />
        {/* Selected state - filled blue circle with white dot (overlays when selected) */}
        <SelectPrimitive.ItemIndicator className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white" />
          </div>
        </SelectPrimitive.ItemIndicator>
      </div>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className,
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className,
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
