import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";

interface OnboardingData {
  role: "admin" | "lawyer" | "assistant";
  specializations: string[];
  barNumber?: string;
  firmName?: string;
  workLocation?: string;
  experienceYears?: number;
  bio?: string;
}

export const OnboardingFlow: React.FC = () => {
  const { user, updateOnboarding } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<OnboardingData>({
    role: "lawyer",
    specializations: [],
  });
  const [isLoading, setIsLoading] = useState(false);

  const legalSpecializations = [
    "Derecho Civil",
    "Derecho Penal",
    "Derecho Mercantil",
    "Derecho Laboral",
    "Derecho de Familia",
    "Derecho Tributario",
    "Derecho Administrativo",
    "Derecho Constitucional",
    "Derecho Internacional",
    "Propiedad Intelectual",
    "Derecho Ambiental",
    "Derecho de la Salud",
  ];

  const handleSpecializationToggle = (specialization: string) => {
    const updated = formData.specializations.includes(specialization)
      ? formData.specializations.filter((s) => s !== specialization)
      : [...formData.specializations, specialization];
    
    setFormData({ ...formData, specializations: updated });
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      await updateOnboarding({
        ...formData,
        onboardingStep: 4,
        isOnboardingComplete: true,
      });
    } catch (error) {
      console.error("Error completing onboarding:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">¡Bienvenido a iAlex!</h2>
              <p className="text-gray-600">
                Empecemos configurando tu perfil profesional.
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  ¿Cuál es tu rol principal?
                </label>
                <Select 
                  value={formData.role} 
                  onValueChange={(value) => setFormData({ ...formData, role: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tu rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lawyer">Abogado</SelectItem>
                    <SelectItem value="assistant">Asistente Legal</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.role === "lawyer" && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Número de matrícula (opcional)
                  </label>
                  <Input
                    value={formData.barNumber || ""}
                    onChange={(e) => setFormData({ ...formData, barNumber: e.target.value })}
                    placeholder="Ingresa tu número de matrícula"
                  />
                </div>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Especialidades Legales</h2>
              <p className="text-gray-600">
                Selecciona las áreas del derecho en las que te especializas.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {legalSpecializations.map((specialization) => (
                <button
                  key={specialization}
                  onClick={() => handleSpecializationToggle(specialization)}
                  className={`p-3 text-sm border rounded-lg transition-colors ${
                    formData.specializations.includes(specialization)
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-300"
                  }`}
                >
                  {specialization}
                </button>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Información Profesional</h2>
              <p className="text-gray-600">
                Cuéntanos más sobre tu experiencia profesional.
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Nombre del despacho/firma (opcional)
                </label>
                <Input
                  value={formData.firmName || ""}
                  onChange={(e) => setFormData({ ...formData, firmName: e.target.value })}
                  placeholder="Ej: Estudio Jurídico García & Asociados"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Ubicación de trabajo (opcional)
                </label>
                <Input
                  value={formData.workLocation || ""}
                  onChange={(e) => setFormData({ ...formData, workLocation: e.target.value })}
                  placeholder="Ej: Buenos Aires, Argentina"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Años de experiencia (opcional)
                </label>
                <Input
                  type="number"
                  value={formData.experienceYears || ""}
                  onChange={(e) => setFormData({ ...formData, experienceYears: parseInt(e.target.value) || undefined })}
                  placeholder="Ej: 5"
                  min="0"
                  max="50"
                />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Última información</h2>
              <p className="text-gray-600">
                Agrega una breve descripción profesional (opcional).
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Biografía profesional
              </label>
              <Textarea
                value={formData.bio || ""}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Describe brevemente tu experiencia y enfoque profesional..."
                className="min-h-[120px]"
                maxLength={500}
              />
              <p className="text-sm text-gray-500 mt-1">
                {(formData.bio || "").length}/500 caracteres
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Resumen de tu perfil:</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Rol:</strong> {
                  formData.role === "lawyer" ? "Abogado" :
                  formData.role === "assistant" ? "Asistente Legal" : "Administrador"
                }</p>
                {formData.specializations.length > 0 && (
                  <p><strong>Especialidades:</strong> {formData.specializations.join(", ")}</p>
                )}
                {formData.firmName && <p><strong>Firma:</strong> {formData.firmName}</p>}
                {formData.experienceYears && <p><strong>Experiencia:</strong> {formData.experienceYears} años</p>}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step <= currentStep
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {step}
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        {renderStep()}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            Anterior
          </Button>
          
          {currentStep < 4 ? (
            <Button onClick={handleNext}>
              Siguiente
            </Button>
          ) : (
            <Button 
              onClick={handleComplete}
              disabled={isLoading}
            >
              {isLoading ? "Completando..." : "Completar configuración"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}; 