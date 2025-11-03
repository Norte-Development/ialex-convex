import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { MigrationConsentDialog } from "./MigrationConsentDialog";
import { MigrationProgressDialog } from "./MigrationProgressDialog";

interface MigrationWrapperProps {
  children: React.ReactNode;
}

/**
 * MigrationWrapper - Checks if user has pending migration
 * and shows appropriate dialogs for consent and progress
 */
export function MigrationWrapper({ children }: MigrationWrapperProps) {
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [migrationCompleted, setMigrationCompleted] = useState(false);

  const migrationStatus = useQuery(api.functions.migration.getMyMigrationStatus);

  // Check migration status and show appropriate dialog
  useEffect(() => {
    if (migrationStatus === null) {
      // No migration needed
      return;
    }

    if (migrationStatus === undefined) {
      // Still loading
      return;
    }

    const { status, consentGiven } = migrationStatus;

    // If migration already completed, don't show dialogs
    if (status === "completed") {
      setMigrationCompleted(true);
      return;
    }

    // If consent not given, show consent dialog
    if (!consentGiven && status === "pending") {
      setShowConsentDialog(true);
      return;
    }

    // If consent given but migration pending or in progress, show progress dialog
    if (consentGiven && (status === "pending" || status === "in_progress")) {
      setShowProgressDialog(true);
      return;
    }

    // If migration failed, show progress dialog (to let user retry)
    if (status === "failed") {
      setShowProgressDialog(true);
      return;
    }
  }, [migrationStatus]);

  const handleConsentGiven = () => {
    setShowConsentDialog(false);
    // Show progress dialog to start migration
    setShowProgressDialog(true);
  };

  const handleMigrationComplete = () => {
    setMigrationCompleted(true);
    setShowProgressDialog(false);
  };

  return (
    <>
      {children}

      <MigrationConsentDialog
        open={showConsentDialog}
        onOpenChange={setShowConsentDialog}
        onConsentGiven={handleConsentGiven}
      />

      <MigrationProgressDialog
        open={showProgressDialog}
        onOpenChange={setShowProgressDialog}
        onMigrationComplete={handleMigrationComplete}
      />
    </>
  );
}

