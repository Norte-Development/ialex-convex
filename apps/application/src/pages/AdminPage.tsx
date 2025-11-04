import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MercadoPagoAdminDashboard } from "@/components/Admin/MercadoPagoAdminDashboard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle } from "lucide-react";

/**
 * Admin page wrapper that checks if user has admin access
 * and renders the appropriate admin dashboard
 */
export default function AdminPage() {
  // Get current user to check admin status
  const currentUser = useQuery(api.functions.users.getCurrentUser, { clerkId: undefined });

  // Check if user has admin role
  const isAdmin = currentUser?._id === "jx7d2qe3tz4t41rf0zqmx0bdy17tah7m" || currentUser?._id === "kn78b2jg35859v48mpgngxbjas7tajmm";

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Acceso Denegado</strong>
            <br />
            No tienes permisos de administrador para acceder a esta página.
            <br />
            <span className="text-sm text-muted-foreground">
              Tu rol actual: {currentUser.role || "Sin rol asignado"}
            </span>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Panel de Administración</h1>
        </div>
        <p className="text-muted-foreground">
          Bienvenido, {currentUser.name}. Aquí puedes gestionar las suscripciones MercadoPago.
        </p>
      </div>
      
      <MercadoPagoAdminDashboard />
    </div>
  );
}
