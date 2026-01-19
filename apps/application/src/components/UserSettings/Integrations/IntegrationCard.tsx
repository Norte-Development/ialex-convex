"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface IntegrationCardProps {
  id: string
  icon: LucideIcon
  title: string
  description: string
  status?: "connected" | "disconnected" | "error"
  statusLabel?: string
  children: ReactNode
  defaultOpen?: boolean
}

export function IntegrationCard({
  id,
  icon: Icon,
  title,
  description,
  status = "disconnected",
  statusLabel,
  children,
  defaultOpen = false,
}: IntegrationCardProps) {
  const statusConfig = {
    connected: {
      variant: "default" as const,
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      label: statusLabel || "Conectada",
    },
    disconnected: {
      variant: "secondary" as const,
      className: "border-border/50 bg-muted/50 text-muted-foreground",
      label: statusLabel || "No conectada",
    },
    error: {
      variant: "destructive" as const,
      className: "border-destructive/30 bg-destructive/10 text-destructive",
      label: statusLabel || "Error",
    },
  }

  const currentStatus = statusConfig[status]

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? id : undefined}
      className="border rounded-lg bg-card hover:border-foreground/20 transition-colors"
    >
      <AccordionItem value={id} className="border-none">
        <AccordionTrigger className="px-6 py-5 hover:no-underline group">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted/50 group-hover:bg-muted transition-colors">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
            <div className="flex-1 text-left space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base">{title}</h3>
                <Badge variant={currentStatus.variant} className={currentStatus.className}>
                  {currentStatus.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6">
          <div className="pt-4 border-t">{children}</div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
