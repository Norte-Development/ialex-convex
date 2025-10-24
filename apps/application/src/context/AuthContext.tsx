import React, { createContext, useContext, ReactNode } from "react";
import { useUser } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface User {
  _id: string;
  clerkId: string;
  name: string;
  email: string;
  isActive: boolean;
  isOnboardingComplete: boolean;
  onboardingStep?: number;
  specializations?: string[];
  barNumber?: string;
  firmName?: string;
  workLocation?: string;
  experienceYears?: number;
  bio?: string;
  // Trial tracking fields
  trialStatus?: "active" | "expired" | "converted" | "none";
  trialStartDate?: number;
  trialEndDate?: number;
  trialPlan?: "premium_individual" | "premium_team";
  hasUsedTrial?: boolean;
}

interface AuthContextType {
  user: User | null | undefined;
  clerkUser: any;
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

  // Only keep the updateOnboardingInfo mutation
  const updateOnboardingInfo = useMutation(api.functions.users.updateOnboardingInfo);

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
