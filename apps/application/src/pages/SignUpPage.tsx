import React from "react";
import { CustomSignUp } from "@/components/Auth/CustomSignUp";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">iAlex</h1>
          <p className="text-gray-600">Tu asistente legal inteligente</p>
        </div>
        <div className="flex justify-center">
          <CustomSignUp redirectUrl="/" />
        </div>
      </div>
    </div>
  );
}
