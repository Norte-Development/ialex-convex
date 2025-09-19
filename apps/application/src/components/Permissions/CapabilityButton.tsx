import { usePermissions } from "@/context/CasePermissionsContext";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VariantProps } from "class-variance-authority";
import React from "react";

// Definir qué capacidades requieren las acciones
type ActionCapability =
  | "viewCase"
  | "editCase"
  | "deleteCase"
  | "manageCase"
  | "docs.read"
  | "docs.write"
  | "docs.delete"
  | "escritos.read"
  | "escritos.write"
  | "escritos.delete"
  | "clients.read"
  | "clients.write"
  | "clients.delete"
  | "teams.read"
  | "teams.write"
  | "chat"
  | "permissions.grant"
  | "permissions.revoke";

interface NewPermissionButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  action: ActionCapability;
  disabledMessage?: string;
  loadingMessage?: string;
  showTooltipOnDisabled?: boolean;
}

export function NewPermissionButton({
  action,
  disabledMessage = "No tienes permisos para esta acción",
  loadingMessage = "Cargando permisos...",
  showTooltipOnDisabled = true,
  children,
  onClick,
  className,
  disabled,
  ...props
}: NewPermissionButtonProps) {
  const { can, isLoading } = usePermissions();

  // Función helper para verificar capacidades anidadas
  const hasCapability = (action: ActionCapability): boolean => {
    if (action.includes(".")) {
      const [module, capability] = action.split(".");
      return (can as any)[module]?.[capability] || false;
    }
    return (can as any)[action] || false;
  };

  const allowed = hasCapability(action);
  const isButtonDisabled = isLoading || disabled || !allowed;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isButtonDisabled) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  const button = (
    <Button
      {...props}
      className={className}
      disabled={isButtonDisabled}
      onClick={handleClick}
    >
      {isLoading ? loadingMessage : children}
    </Button>
  );

  // Si está deshabilitado y queremos mostrar tooltip
  if (isButtonDisabled && showTooltipOnDisabled && !isLoading) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{disabledMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}

// Componente envuelto para compatibilidad con el sistema anterior
export function CapabilityButton({
  action,
  ...props
}: NewPermissionButtonProps) {
  return <NewPermissionButton action={action} {...props} />;
}
