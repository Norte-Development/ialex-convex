import React from "react";
import { SignIn } from "@clerk/clerk-react";
import { 
  Briefcase, 
  Users, 
  FileText, 
  Brain, 
  Database, 
  UsersRound
} from "lucide-react";

export const SignInPage: React.FC = () => {
  const features = [
    {
      icon: Briefcase,
      title: "Gestión de Casos",
      description: "Organiza y gestiona todos tus casos jurídicos en un solo lugar"
    },
    {
      icon: Users,
      title: "Gestión de Clientes",
      description: "Mantén un registro completo de tus clientes y su historial"
    },
    {
      icon: FileText,
      title: "Documentos Inteligentes",
      description: "Almacena, organiza y busca documentos con IA avanzada"
    },
    {
      icon: Brain,
      title: "Asistente de IA",
      description: "Asistente legal especializado disponible 24/7"
    },
    {
      icon: Database,
      title: "Base de Datos Legal",
      description: "Accede a legislación y jurisprudencia con búsqueda semántica"
    },
    {
      icon: UsersRound,
      title: "Colaboración en Equipos",
      description: "Trabaja en equipo con permisos granulares y control de acceso"
    }
  ];

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Left Side - Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-primary/10 via-secondary to-background p-8 flex-col justify-center">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <img src="/ialex-registro.webp" alt="iAlex" className="h-28"/>
            </div>  
            <p className="text-sm text-muted-foreground">
              Plataforma integral de gestión legal que combina organización tradicional 
              con inteligencia artificial avanzada para modernizar tu práctica jurídica.
            </p>
          </div>

          <ul className="space-y-3 mt-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <li key={index} className="flex items-start gap-3">
                  <div className="p-1.5 rounded bg-primary/10 text-primary shrink-0 mt-0.5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Right Side - Sign In Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-8 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-4">
            <div className="flex items-center justify-center gap-2 mb-1">
              <img src="/ialex-registro.webp" alt="iAlex" className="h-28"/>
            </div>
          </div>

          {/* Sign In Component */}
          <div className="flex flex-col items-center gap-4">
            <SignIn
              signUpUrl="/signup"
              appearance={{
                elements: {
                  formButtonPrimary: "bg-primary hover:bg-primary/90 text-sm normal-case",
                  card: "shadow-lg border-border",
                  headerTitle: "text-foreground",
                  headerSubtitle: "text-muted-foreground",
                  socialButtonsBlockButton: "border border-border hover:bg-secondary",
                  formFieldInput: "border border-input focus:border-primary focus:ring-1 focus:ring-primary",
                  footerActionLink: "text-primary hover:text-primary/80"
                }
              }}
            />
            <p className="text-xs text-muted-foreground text-center">
              Al iniciar sesión, aceptas nuestra{" "}
              <a 
                href="https://ialex.com.ar/politica-privacidad" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Política de Privacidad
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}; 