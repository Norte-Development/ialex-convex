import { Suspense, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AppSkeleton } from "@/components/Skeletons";
import { HomePageSkeleton } from "@/components/Home/Skeletons";
import { DataBasePageSkeleton } from "@/components/DataBase/Skeletons/DataBasePageSkeleton";
import { ClientsPageSkeleton } from "@/components/Clients/Skeletons/ClientsPageSkeleton";
import { CasesPageSkeleton } from "@/components/Cases/Skeletons";

interface RouteSuspenseProps {
  children: ReactNode;
}

/**
 * Componente que muestra el skeleton correcto según la ruta actual
 * mientras se carga el componente lazy
 */
export function RouteSuspense({ children }: RouteSuspenseProps) {
  const location = useLocation();

  // Determinar qué skeleton mostrar según la ruta
  const getSkeleton = () => {
    const path = location.pathname;

    // HomePage skeleton
    if (path === "/" || path === "") {
      return <HomePageSkeleton />;
    }

    // DataBasePage skeleton
    if (path.startsWith("/base-de-datos")) {
      return <DataBasePageSkeleton />;
    }

    // ClientsPage skeleton
    if (path.startsWith("/clientes")) {
      return <ClientsPageSkeleton />;
    }

    // CasesPage skeleton
    if (path.startsWith("/casos")) {
      return <CasesPageSkeleton />;
    }

    // Por defecto, usar AppSkeleton
    return <AppSkeleton />;
  };

  return <Suspense fallback={getSkeleton()}>{children}</Suspense>;
}
