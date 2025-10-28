import { SignUp } from "@clerk/clerk-react";
import { useSearchParams } from "react-router-dom";

export default function SignUpPage() {
  const [searchParams] = useSearchParams();
  const isTrial = searchParams.get('trial') === 'true';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">iAlex</h1>
          <p className="text-gray-600">Tu asistente legal inteligente</p>
          {isTrial && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 font-semibold">🎉 ¡Prueba Premium Gratis!</p>
              <p className="text-blue-600 text-sm">14 días de acceso completo a todas las funciones Premium</p>
            </div>
          )}
        </div>
        <div className="flex justify-center">
          <SignUp 
            fallbackRedirectUrl={isTrial ? "/?trial=true" : "/"}
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
        {/* {!isTrial && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              ¿Quieres probar Premium?{" "}
              <a href="/signup?trial=true" className="text-blue-600 font-semibold hover:underline">
                Inicia tu prueba gratuita de 14 días
              </a>
            </p>
          </div>
        )} */}
      </div>
    </div>
  );
}
