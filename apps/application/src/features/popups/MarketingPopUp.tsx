import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMarketingPopup } from "@/hooks/useMarketingPopup";
import { usePopupGate } from "./PopupGate";

export function MarketingPopUp() {
  const { active, recordImpression, dismiss } = useMarketingPopup();
  const { tryAcquire, release } = usePopupGate();

  const serverPopup = active?.popup ?? null;
  const serverPopupId = serverPopup?._id ?? null;

  const [isOpen, setIsOpen] = useState(false);
  const [displayPopup, setDisplayPopup] = useState<any | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const impressionSentFor = useRef<string | null>(null);

  const displayPopupId = displayPopup?._id ?? null;

  const gateKey = useMemo(() => {
    const id = displayPopupId ?? serverPopupId;
    if (!id) return null;
    return `marketing:${String(id)}`;
  }, [displayPopupId, serverPopupId]);

  const closeAndDismiss = () => {
    const id = displayPopupId;
    const key = id ? `marketing:${String(id)}` : gateKey;

    setIsOpen(false);
    if (key) release(key);

    if (id) {
      setDismissedId(String(id));
      void dismiss({ popupId: id });
    }

    setDisplayPopup(null);
  };

  useEffect(() => {
    // If it's already open, keep it stable until user closes.
    if (isOpen) return;

    if (!serverPopupId || !gateKey) {
      setDisplayPopup(null);
      setIsOpen(false);
      return;
    }

    // Prevent immediate re-open if we just dismissed and query hasn't refreshed yet.
    if (dismissedId && String(serverPopupId) === dismissedId) {
      setDisplayPopup(null);
      setIsOpen(false);
      return;
    }

    const acquired = tryAcquire(gateKey);
    if (!acquired) return;

    setDisplayPopup(serverPopup);
    setIsOpen(true);

    if (impressionSentFor.current !== String(serverPopupId)) {
      impressionSentFor.current = String(serverPopupId);
      void recordImpression({ popupId: serverPopupId });
    }
  }, [
    isOpen,
    serverPopup,
    serverPopupId,
    gateKey,
    tryAcquire,
    dismissedId,
    recordImpression,
  ]);

  // If the server changes the popup, allow showing again.
  useEffect(() => {
    if (!serverPopupId) {
      setDismissedId(null);
      return;
    }
    if (dismissedId && dismissedId !== String(serverPopupId)) {
      setDismissedId(null);
    }
  }, [serverPopupId, dismissedId]);

  if (!displayPopup) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open) return;

        closeAndDismiss();
      }}
    >
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{displayPopup.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {displayPopup.body}
          </p>

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                closeAndDismiss();
              }}
            >
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
