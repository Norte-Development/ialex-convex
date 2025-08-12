import React, { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { OnboardingFlow } from "../Onboarding/OnboardingFlow";
import { OnboardingSkeleton } from "../Skeletons";

interface OnboardingWrapperProps {
  children: React.ReactNode;
}

export const OnboardingWrapper: React.FC<OnboardingWrapperProps> = ({ children }) => {
  const { user: clerkUser } = useUser();
  const { isAuthenticated } = useConvexAuth();
  
  // Get user data from Convex database - only query when Convex considers user authenticated
  const user = useQuery(
    api.functions.users.getCurrentUser,
    isAuthenticated && clerkUser ? { clerkId: clerkUser.id } : "skip"
  );

  // Auto-sync user on first authentication
  const getOrCreateUser = useMutation(api.functions.users.getOrCreateUser);

  // Auto-sync user when they're first authenticated
  useEffect(() => {
    const syncUser = async () => {
      if (!clerkUser || !isAuthenticated) return;

      try {
        const email = clerkUser.emailAddresses[0]?.emailAddress || "";
        const name = clerkUser.fullName || clerkUser.firstName || "Unknown User";

        await getOrCreateUser({
          clerkId: clerkUser.id,
          email,
          name,
        });
      } catch (error) {
        console.error("Error auto-syncing user:", error);
      }
    };

    // Only sync if we have clerkUser, Convex auth is ready, but no database user yet
    if (clerkUser && isAuthenticated && user === null) {
      syncUser();
    }
  }, [clerkUser, isAuthenticated, user, getOrCreateUser]);

  // Show onboarding skeleton while loading user data
  if (isAuthenticated && user === undefined) {
    return <OnboardingSkeleton />;
  }

  // If no user found in database and we're still syncing, show onboarding skeleton
  if (isAuthenticated && !user) {
    return <OnboardingSkeleton />;
  }

  // Show onboarding flow if user hasn't completed onboarding
  if (user && !user.isOnboardingComplete) {
    return <OnboardingFlow />;
  }

  // User is fully set up, show the main app
  return <>{children}</>;
}; 