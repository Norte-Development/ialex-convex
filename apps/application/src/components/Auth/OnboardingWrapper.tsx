import React, { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { OnboardingFlow } from "../Onboarding/OnboardingFlow";
import { AuthLoadingSkeleton } from "../AuthLoadingSkeleton";

interface OnboardingWrapperProps {
  children: React.ReactNode;
}

export const OnboardingWrapper: React.FC<OnboardingWrapperProps> = ({
  children,
}) => {
  const { user: clerkUser } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const [searchParams] = useSearchParams();

  // Get user data from Convex database - only query when Convex considers user authenticated
  const user = useQuery(
    api.functions.users.getCurrentUser,
    isAuthenticated && clerkUser ? { clerkId: clerkUser.id } : "skip",
  );

  // Auto-sync user on first authentication
  const getOrCreateUser = useMutation(api.functions.users.getOrCreateUser);

  // Auto-sync user when they're first authenticated
  useEffect(() => {
    const syncUser = async () => {
      if (!clerkUser || !isAuthenticated) return;

      try {
        const email = clerkUser.emailAddresses[0]?.emailAddress || "";
        const name =
          clerkUser.fullName || clerkUser.firstName || "Unknown User";

        // Check if this is a trial signup
        const isTrial = searchParams.get('trial') === 'true';
        
        console.log("🔍 Creating user with trial info:", {
          email,
          name,
          isTrial,
          clerkId: clerkUser.id,
          searchParams: searchParams.toString()
        });

        await getOrCreateUser({
          clerkId: clerkUser.id,
          email,
          name,
          startTrial: isTrial,
        });
      } catch (error) {
        console.error("Error auto-syncing user:", error);
      }
    };

    // Only sync if we have clerkUser, Convex auth is ready, but no database user yet
    if (clerkUser && isAuthenticated && user === null) {
      syncUser();
    }
  }, [clerkUser, isAuthenticated, user, getOrCreateUser, searchParams]);

  // Show skeleton while loading user data (uses route-aware skeleton)
  if (isAuthenticated && user === undefined) {
    return <AuthLoadingSkeleton />;
  }

  // If no user found in database and we're still syncing, show skeleton
  if (isAuthenticated && !user) {
    return <AuthLoadingSkeleton />;
  }

  // Show onboarding flow if user hasn't completed onboarding
  if (user && !user.isOnboardingComplete) {
    console.log("🚀 Showing onboarding flow for user:", user);
    return <OnboardingFlow user={user} />;
  }

  // Debug logging
  if (user) {
    console.log("👤 User found, onboarding status:", {
      isOnboardingComplete: user.isOnboardingComplete,
      trialStatus: user.trialStatus,
      hasUsedTrial: user.hasUsedTrial
    });
  }

  // User is fully set up, show the main app
  return <>{children}</>;
};
