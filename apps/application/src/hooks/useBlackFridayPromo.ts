import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useBillingData } from "@/components/Billing/useBillingData";
import { BLACK_FRIDAY_CONFIG } from "@/config/blackFriday";

export function useBlackFridayPromo() {
  const [isOpen, setIsOpen] = useState(false);
  const { plan, isLoading: isBillingLoading, userId } = useBillingData();
  
  const trialUser = useQuery(api.billing.trials.getTrialUser, 
    userId ? { userId } : "skip"
  );

  useEffect(() => {
    // Wait for all data to be loaded
    if (isBillingLoading || !userId || trialUser === undefined) return;

    checkEligibility();
  }, [isBillingLoading, userId, trialUser, plan]);

  const checkEligibility = () => {
    const now = new Date();
    
    console.log("Checking Black Friday Promo Eligibility...", {
      enabled: BLACK_FRIDAY_CONFIG.isEnabled,
      now,
      start: BLACK_FRIDAY_CONFIG.startDate,
      end: BLACK_FRIDAY_CONFIG.endDate,
      plan,
      trialUser
    });

    // 1. Check window & enabled status
    if (!BLACK_FRIDAY_CONFIG.isEnabled) {
      console.log("Promo disabled via config");
      return;
    }
    if (now < BLACK_FRIDAY_CONFIG.startDate) {
      console.log("Promo hasn't started yet");
      return;
    }
    if (now > BLACK_FRIDAY_CONFIG.endDate) {
      console.log("Promo has ended");
      return;
    }

    // 2. Identify user status
    const isTrialActive = trialUser?.trialStatus === "active";
    const isPaidUser = plan !== "free" && !isTrialActive;
    const isConvertedTrial = trialUser?.trialStatus === "converted";

    if (isPaidUser || isConvertedTrial) {
      console.log("User is already paid or converted", { isPaidUser, isConvertedTrial });
      return;
    }

    const isTargetUser = plan === "free" || isTrialActive;
    
    if (!isTargetUser) {
      console.log("User is not in target group (not free, not active trial)");
      return;
    }

    // 3. Frequency Check (Once per day)
    const storageKeyDate = `${BLACK_FRIDAY_CONFIG.storageKeys.lastShown}-${userId}`;
    const lastShown = localStorage.getItem(storageKeyDate);
    const today = new Date().toLocaleDateString();
    
    if (lastShown === today) {
      console.log("Already shown today");
      return;
    }

    // 4. Impressions Cap (Optional)
    const storageKeyImpressions = `${BLACK_FRIDAY_CONFIG.storageKeys.impressions}-${userId}`;
    const impressions = parseInt(localStorage.getItem(storageKeyImpressions) || "0");
    if (impressions >= BLACK_FRIDAY_CONFIG.maxImpressions) {
      console.log("Max impressions reached");
      return;
    }

    // If we got here, show the popup
    console.log("Showing Black Friday Promo!");
    setIsOpen(true);
    
    // Update storage immediately to prevent showing again on reload
    localStorage.setItem(storageKeyDate, today);
    localStorage.setItem(storageKeyImpressions, (impressions + 1).toString());
  };

  const close = () => setIsOpen(false);

  return { isOpen, close };
}

