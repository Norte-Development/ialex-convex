import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useBillingData } from "@/components/Billing/useBillingData";
import { FREEMIUM_UPGRADE_CONFIG } from "@/config/freemiumUpgrade";
import { usePopupGate } from "@/features/popups/PopupGate";

export function useFreemiumUpgrade() {
  const [isOpen, setIsOpen] = useState(false);
  const { tryAcquire, release } = usePopupGate();
  const { plan, isLoading: isBillingLoading, userId } = useBillingData();

  const user = useQuery(api.functions.users.getCurrentUser, {});

  useEffect(() => {
    // Wait for all data to be loaded
    if (isBillingLoading || !userId || user === undefined) return;

    checkEligibility();
  }, [isBillingLoading, userId, user, plan]);

  const checkEligibility = () => {
    console.log("Checking Freemium Upgrade Popup Eligibility...", {
      enabled: FREEMIUM_UPGRADE_CONFIG.isEnabled,
      plan,
      user,
    });

    // 1. Check if feature is enabled
    if (!FREEMIUM_UPGRADE_CONFIG.isEnabled) {
      console.log("Freemium popup disabled via config");
      return;
    }

    // 2. Only show to free users (not trial, not premium)
    const isFreeUser = plan === "free";
    const isTrialActive = user?.trialStatus === "active";
    const isPremium = plan !== "free" && !isTrialActive;

    if (!isFreeUser || isTrialActive || isPremium) {
      console.log("User is not eligible (not free plan)", {
        isFreeUser,
        isTrialActive,
        isPremium,
      });
      return;
    }

    // 3. Check if user has been registered long enough
    if (user?._creationTime) {
      const registrationDate = new Date(user._creationTime);
      const daysSinceRegistration = Math.floor(
        (Date.now() - registrationDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysSinceRegistration < FREEMIUM_UPGRADE_CONFIG.showAfterDays) {
        console.log("User registered too recently", { daysSinceRegistration });
        return;
      }
    }

    // 4. Frequency Check (Show every X days)
    const storageKeyDate = `${FREEMIUM_UPGRADE_CONFIG.storageKeys.lastShown}-${userId}`;
    const lastShown = localStorage.getItem(storageKeyDate);

    if (lastShown) {
      const lastShownDate = new Date(lastShown);
      const daysSinceLastShown = Math.floor(
        (Date.now() - lastShownDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysSinceLastShown < FREEMIUM_UPGRADE_CONFIG.frequencyDays) {
        console.log("Popup shown too recently", { daysSinceLastShown });
        return;
      }
    }

    // 5. Impressions Cap
    const storageKeyImpressions = `${FREEMIUM_UPGRADE_CONFIG.storageKeys.impressions}-${userId}`;
    const impressions = parseInt(
      localStorage.getItem(storageKeyImpressions) || "0",
    );

    if (impressions >= FREEMIUM_UPGRADE_CONFIG.maxImpressions) {
      console.log("Max impressions reached", { impressions });
      return;
    }

    // If we got here, show the popup
    console.log("Showing Freemium Upgrade Popup!");
    const gateKey = "freemiumUpgrade";
    if (!tryAcquire(gateKey)) {
      console.log("Popup gate busy; skipping Freemium Upgrade Popup");
      return;
    }
    setIsOpen(true);

    // Update storage immediately to prevent showing again on reload
    localStorage.setItem(storageKeyDate, new Date().toISOString());
    localStorage.setItem(storageKeyImpressions, (impressions + 1).toString());
  };

  const close = () => {
    setIsOpen(false);
    release("freemiumUpgrade");
  };

  return { isOpen, close };
}
