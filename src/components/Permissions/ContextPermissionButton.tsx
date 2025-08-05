import { PERMISSIONS, type Permission } from "@/permissions/types";
import { useCasePerms } from "@/contexts/CasePermissionsContext";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VariantProps } from "class-variance-authority";
import React from "react";

interface ContextPermissionButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  permission: Permission;
  disabledMessage?: string;
  loadingMessage?: string;
  asChild?: boolean;
}

export function ContextPermissionButton({ 
  permission, 
  disabledMessage = "No tienes permisos para esta acción",
  loadingMessage = "Cargando permisos...",
  children,
  onClick,
  ...props 
}: ContextPermissionButtonProps) {
  const { hasPermission, isLoading } = useCasePerms();
  const allowed = hasPermission(permission);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!allowed || isLoading || props.disabled) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  const buttonContent = (
    <Button 
      {...props} 
      onClick={handleClick}
      aria-disabled={!allowed || props.disabled || isLoading}
      className={`${!allowed || isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${props.className || ''}`}
    >
      {children}
    </Button>
  );

  // Show loading state
  if (isLoading) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex w-full">{buttonContent}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{loadingMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Show disabled state with tooltip
  if (!allowed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex w-full">{buttonContent}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{disabledMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Normal enabled state
  return buttonContent;
} 