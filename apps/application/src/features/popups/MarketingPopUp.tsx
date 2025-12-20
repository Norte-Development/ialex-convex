import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CircleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMarketingPopup } from "@/hooks/useMarketingPopup";
import { usePopupGate } from "./PopupGate";
import { useNavigate } from "react-router-dom";
import { useUpgrade } from "@/components/Billing/useUpgrade";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
export function MarketingPopUp() {
  const { active, recordImpression, dismiss } = useMarketingPopup();
  const { tryAcquire, release } = usePopupGate();
  const navigate = useNavigate();
  const { upgradeToPlan, isUpgrading } = useUpgrade({
    onSuccess: () => {
      // The user will be redirected to Stripe; keep modal closed.
    },
  });

  const serverPopup = active?.popup ?? null;
  const serverPopupId = serverPopup?._id ?? null;

  const [isOpen, setIsOpen] = useState(false);
  const [displayPopup, setDisplayPopup] = useState<any | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const impressionSentFor = useRef<string | null>(null);
  const getPopupImageUrl = useAction(api.functions.popups.getPopupImageUrl);

  console.log("Server popup:", serverPopup);
  console.log("displayPopup:", displayPopup);

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

  // Load image URL when popup changes
  useEffect(() => {
    if (!displayPopup?._id || !displayPopup?.imageGcsBucket) {
      setImageUrl(null);
      return;
    }

    let cancelled = false;
    getPopupImageUrl({ popupId: displayPopup._id })
      .then((url) => {
        if (!cancelled && url) setImageUrl(url);
      })
      .catch((e) => {
        console.error("Failed to get popup image URL:", e);
      });

    return () => {
      cancelled = true;
    };
  }, [displayPopup?._id, displayPopup?.imageGcsBucket, getPopupImageUrl]);

  if (!displayPopup) return null;

  const actions = Array.isArray(displayPopup.actions)
    ? (displayPopup.actions as any[])
    : [];

  const handleAction = async (action: any) => {
    if (!action) return;

    if (action.type === "link") {
      const url = typeof action.url === "string" ? action.url.trim() : "";
      if (!url) return;
      const newTab = action.newTab !== false;
      closeAndDismiss();
      if (newTab) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = url;
      }
      return;
    }

    if (action.type === "billing") {
      const mode = action.billingMode ?? "plans";
      if (mode === "plans") {
        closeAndDismiss();
        navigate("/preferencias?section=billing");
        return;
      }

      closeAndDismiss();
      if (mode === "checkout_team") {
        await upgradeToPlan("premium_team");
        return;
      }
      await upgradeToPlan("premium_individual");
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open) return;

        closeAndDismiss();
      }}
    >
      {displayPopup.template === "promo" ? (
        <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden text-white border-border">
          <div className="flex flex-col md:flex-row h-full">
            <div className="w-full md:w-[40%] relative min-h-[200px] md:min-h-full flex flex-col items-center justify-center p-8 overflow-hidden bg-linear-to-br from-primary to-primary/80">
              {/* Background Image */}
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
              )}
              <div className="relative z-10 text-center space-y-2">
                {displayPopup.badgeText ? (
                  <div className="flex justify-center">
                    <Badge className="px-4 py-1 text-xl" variant="secondary">
                      {displayPopup.badgeText}
                    </Badge>
                  </div>
                ) : null}
                <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-none">
                  {displayPopup.title}
                </h2>
                {displayPopup.subtitle ? (
                  <p className="text-lg font-semibold text-white/90 whitespace-pre-wrap">
                    {displayPopup.subtitle}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="w-full md:w-[60%] p-6 md:p-8 flex flex-col bg-background relative h-full">
              {actions.length > 0 ? (
                <div className="mt-auto flex flex-col gap-4 h-full md:justify-between">
                  {displayPopup.upperBody ? (
                    <p className="text-xl font-bold whitespace-pre-wrap">
                      {displayPopup.upperBody}
                    </p>
                  ) : null}
                  <p className="text-lg text-zinc-300 whitespace-pre-wrap">
                    {displayPopup.body}
                  </p>
                  {actions.slice(0, 2).map((action, idx) => (
                    <Button
                      key={idx}
                      onClick={() => void handleAction(action)}
                      disabled={isUpgrading}
                      variant={idx === 0 ? "default" : "outline"}
                      className="w-full h-auto py-4 px-6 flex items-center justify-between"
                    >
                      <span className="text-sm font-semibold">
                        {action.label}
                      </span>
                      <span className="text-sm font-bold">→</span>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="mt-auto flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      closeAndDismiss();
                    }}
                  >
                    Cerrar
                  </Button>
                </div>
              )}

              {actions.length > 0 ? (
                <Button
                  variant="ghost"
                  className="mt-4 text-zinc-300 hover:text-white"
                  onClick={() => closeAndDismiss()}
                >
                  Cerrar
                </Button>
              ) : null}
            </div>
          </div>
        </DialogContent>
      ) : (
        <DialogContent className="sm:max-w-[900px] flex flex-col md:flex-row p-0 gap-0">
          <div
            className="relative space-y-4  w-full md:w-[40%] h-full flex flex-col items-center justify-center px-5 py-8 overflow-hidden"
            style={{
              background:
                "linear-gradient(180deg, #224A8A 7.05%, rgba(99, 179, 255, 0.87) 48.89%, #002146 97.79%)",
            }}
          >
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-4xl font-bold text-white text-center">
                {displayPopup.title}
              </DialogTitle>
            </DialogHeader>
            {displayPopup.subtitle ? (
              <p className="relative z-10 text-base font-medium whitespace-pre-wrap text-white/90 text-center">
                {displayPopup.subtitle}
              </p>
            ) : null}
            {actions.length > 0 ? (
              <div className="flex flex-col gap-2">
                {actions.slice(0, 2).map((action, idx) => (
                  <Button
                    key={idx}
                    onClick={() => void handleAction(action)}
                    disabled={isUpgrading}
                    variant={idx === 0 ? "default" : "outline"}
                    className="w-full text-sm font-bold bg-white text-primary"
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="w-full md:w-[60%] h-full gap-10 px-10 flex flex-col justify-center py-10 bg-[#323232] items-center">
            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                className="h-[75%] w-[950%] object-cover bg-red-400"
              />
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
