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
          <div className="w-full h-full relative min-h-[200px]  flex flex-col items-center justify-center  overflow-hidden bg-[#022570] pt-20">
            {displayPopup.badgeText ? (
              <div className="flex justify-center">
                <Badge className="px-4 py-1 text-xl" variant="secondary">
                  {displayPopup.badgeText}
                </Badge>
              </div>
            ) : null}
            <h2 className="text-3xl md:text-5xl  h-full font-black tracking-tight text-white leading-none translate-y-5">
              {displayPopup.title}
            </h2>
            <div className="flex  gap-0 p-0  w-full h-full  ">
              <div className="w-[40%] h-full gap-2  flex flex-col justify-center items-center">
                {displayPopup.body ? (
                  <p className="text-3xl text-center px-5 text-semibold  text-white/90 whitespace-pre-wrap">
                    {displayPopup.body}
                  </p>
                ) : null}
                {actions.slice(0, 2).map((action, idx) => (
                  <Button
                    key={idx}
                    onClick={() => void handleAction(action)}
                    disabled={isUpgrading}
                    variant={idx === 0 ? "default" : "outline"}
                    className="w-fit text-small  bg-[#022570] text-white hover:bg-[#022570] hover:text-white border px-5 shadow-lg"
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
              <div className="w-[60%] h-full flex justify-center items-center p-5">
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-[75%] w-[950%] object-cover bg-red-400"
                  />
                )}
              </div>
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
            {displayPopup.body ? (
              <p className="text-XL text-center px-5  text-white/90 whitespace-pre-wrap">
                {displayPopup.body}
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
                    className="w-full text-sm font-bold bg-white text-primary hover:bg-primary hover:text-white"
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
                className="h-[75%] w-[950%] object-cover "
              />
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
