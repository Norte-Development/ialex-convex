import { Plus, FolderOpen, Book, UserPlus } from "lucide-react";
import QuickActionCard from "@/components/Home/QuickActionCard";

export function QuickActions() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <QuickActionCard
        title="Crear Caso"
        subtitle="Iniciar un nuevo expediente"
        href="/casos"
        icon={Plus}
        variant="primary"
      />
      <QuickActionCard
        title="Biblioteca"
        subtitle="Gestionar documentos"
        href="/biblioteca"
        icon={FolderOpen}
        variant="primary"
      />
      <QuickActionCard
        title="Base Legal"
        subtitle="Consultar jurisprudencia"
        href="/base-de-datos"
        icon={Book}
        variant="secondary"
      />
      <QuickActionCard
        title="Crear Cliente"
        subtitle="Añadir nuevo cliente"
        href="/clientes"
        icon={UserPlus}
        variant="secondary"
      />
    </div>
  );
}

