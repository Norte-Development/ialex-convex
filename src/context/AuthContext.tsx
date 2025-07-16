import React, { createContext, useContext, ReactNode } from "react";
import { useUser } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface User {
  _id: string;
  clerkId: string;
  name: string;
  email: string;
  role: "admin" | "lawyer" | "assistant";
  isActive: boolean;
  isOnboardingComplete: boolean;
  onboardingStep?: number;
  specializations?: string[];
  barNumber?: string;
  firmName?: string;
  workLocation?: string;
  experienceYears?: number;
  bio?: string;
}

interface AuthContextType {
  user: User | null | undefined;
  clerkUser: any;
  syncUser: () => Promise<void>;
  updateOnboarding: (data: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { user: clerkUser } = useUser();

  // Get current user from database
  const user = useQuery(
    api.functions.users.getCurrentUser,
    clerkUser ? { clerkId: clerkUser.id } : "skip"
  );

  // Convex mutations
  const getOrCreateUser = useMutation(api.functions.users.getOrCreateUser);
  const updateOnboardingInfo = useMutation(api.functions.users.updateOnboardingInfo);

  // Sync user with database
  const syncUser = async () => {
    if (!clerkUser) return;

    try {
      const email = clerkUser.emailAddresses[0]?.emailAddress || "";
      const name = clerkUser.fullName || clerkUser.firstName || "Unknown User";

      await getOrCreateUser({
        clerkId: clerkUser.id,
        email,
        name,
      });
    } catch (error) {
      console.error("Error syncing user:", error);
    }
  };

  // Update onboarding info
  const updateOnboarding = async (data: any) => {
    if (!clerkUser) return;

    try {
      await updateOnboardingInfo({
        clerkId: clerkUser.id,
        ...data,
      });
    } catch (error) {
      console.error("Error updating onboarding:", error);
    }
  };

  const value = {
    user,
    clerkUser,
    syncUser,
    updateOnboarding,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
};
