import React from "react";
import { SignIn } from "@clerk/clerk-react";

export const SignInPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">iAlex</h1>
          <p className="text-gray-600">Tu asistente legal inteligente</p>
        </div>
        <div className="flex justify-center">
          <SignIn 
            redirectUrl="/"
            localization={{
              locale: "es"
            }}
            appearance={{
              elements: {
                formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-sm normal-case",
                card: "shadow-lg",
                headerTitle: "text-gray-900",
                headerSubtitle: "text-gray-600",
                socialButtonsBlockButton: "border border-gray-300 hover:bg-gray-50",
                formFieldInput: "border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
                footerActionLink: "text-blue-600 hover:text-blue-800"
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}; 