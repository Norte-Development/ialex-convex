import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function DriveConnectedPage() {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const success = params.get("success") === "true";

    // If we have an opener (original tab), refresh it and close this tab
    if (window.opener && !window.opener.closed) {
      try {
        // Reload the original tab so it picks up the new Google Drive connection state
        window.opener.location.reload();
      } catch {
        // Ignore cross-origin or other errors; user can refresh manually
      }
      window.close();
      return;
    }

    // Fallback: if there's no opener, just redirect to home
    if (success) {
      window.location.href = "/";
    }
  }, [location.search]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="rounded-lg bg-white p-6 shadow-md">
        <h1 className="text-lg font-semibold mb-2">Conectando Google Drive...</h1>
        <p className="text-sm text-muted-foreground">
          Puedes cerrar esta pestaña en unos segundos. Si no se actualiza automáticamente,
          vuelve a la pestaña original y recarga la página.
        </p>
      </div>
    </div>
  );
}
