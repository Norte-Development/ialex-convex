import { cn } from "@/lib/utils"
import { Globe, Bell, Shield, Bot, BookOpen, CreditCard, MessageCircle } from "lucide-react"

const navItems = [
  { id: "general", label: "General", icon: Globe },
  { id: "notifications", label: "Notificaciones", icon: Bell },
  { id: "agent", label: "Agente IA", icon: Bot },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "billing", label: "Facturación", icon: CreditCard },
  { id: "privacy", label: "Privacidad y Seguridad", icon: Shield },
  { id: "agentRules", label: "Reglas del Agente", icon: BookOpen },
]

interface PreferencesNavProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function PreferencesNav({ activeSection, onSectionChange }: PreferencesNavProps) {
  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              activeSection === item.id
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
