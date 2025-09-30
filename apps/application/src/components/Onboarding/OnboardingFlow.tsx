import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { CircleArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OnboardingData {
  // Paso 2: Nombre
  fullName?: string;

  // Paso 3: ¿Tiene despacho?
  hasDespacho: boolean | null;
  despachoName?: string;

  // Paso 4: Información del despacho (CONDICIONAL)
  firmName?: string;
  workLocation?: string;

  // Paso 5: ¿Cuál es su rol?
  role: "abogado" | "secretario" | "asistente" | "otro" | null;

  // Paso 6: Número de matrícula (CONDICIONAL - solo si role === "abogado")
  barNumber?: string;

  // Paso 7: Cuéntenos sobre usted
  bio?: string;
  experienceYears?: number;

  // Paso 8: Especialización
  specializations: string[];
}

export const OnboardingFlow: React.FC = () => {
  const { user, updateOnboarding } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<OnboardingData>({
    hasDespacho: null,
    role: null,
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

  // Lógica de navegación condicional
  const handleNext = () => {
    // Paso 3 → Paso 4 o Paso 5 (depende de hasDespacho)
    if (currentStep === 3) {
      if (formData.hasDespacho === true) {
        setCurrentStep(4); // Va a info del despacho
      } else {
        setCurrentStep(5); // Salta directo a rol
      }
      return;
    }

    // Paso 4 → Paso 5 (después de info del despacho)
    if (currentStep === 4) {
      setCurrentStep(5);
      return;
    }

    // Paso 5 → Paso 6 o Paso 7 (depende de role)
    if (currentStep === 5) {
      if (formData.role === "abogado") {
        setCurrentStep(6); // Va a número de matrícula
      } else {
        setCurrentStep(7); // Salta a "Cuéntenos sobre usted"
      }
      return;
    }

    // Navegación normal para otros pasos
    if (currentStep < 9) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    // Paso 5 → Paso 3 o Paso 4 (depende de si tiene despacho)
    if (currentStep === 5) {
      if (formData.hasDespacho === true) {
        setCurrentStep(4); // Vuelve a info del despacho
      } else {
        setCurrentStep(3); // Vuelve a pregunta de despacho
      }
      return;
    }

    // Paso 7 → Paso 3, 5 o 6 (depende de hasDespacho y role)
    if (currentStep === 7) {
      // Si es autónomo (no tiene despacho), vuelve al paso 3
      if (formData.hasDespacho === false) {
        setCurrentStep(3);
      } else if (formData.role === "abogado") {
        setCurrentStep(6); // Vuelve a matrícula
      } else {
        setCurrentStep(5); // Vuelve a rol
      }
      return;
    }

    // Navegación normal para otros pasos
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      const onboardingData = {
        fullName: formData.fullName,
        hasDespacho: formData.hasDespacho,
        despachoName: formData.despachoName,
        firmName: formData.firmName,
        workLocation: formData.workLocation,
        role: formData.role,
        barNumber: formData.barNumber,
        experienceYears: formData.experienceYears,
        bio: formData.bio,
        specializations: formData.specializations,
        onboardingStep: 9,
        isOnboardingComplete: true,
      };

      await updateOnboarding(onboardingData);

      console.log("✅ Onboarding completado exitosamente");
    } catch (error) {
      console.error("❌ Error completing onboarding:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      // Paso 1: Bienvenida
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-[24px] font-[400] mb-2 text-tertiary">
                ¡Bienvenido a iAlex!
              </h2>
              <p className="text-black mb-10 text-[14px]">
                Vamos a configurar su perfil profesional
              </p>
              <Button
                onClick={handleNext}
                className="bg-tertiary rounded-[8px] text-white hover:bg-tertiary/90 px-20"
                size={"lg"}
              >
                Comenzar
              </Button>
            </div>
          </div>
        );

      // Paso 2: Información básica
      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center flex flex-col items-center">
              <h2 className="text-[24px] font-[400] mb-2 text-tertiary">
                ¿Cuál es su nombre?
              </h2>
              <Input
                type="text"
                value={formData.fullName || ""}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                className="bg-white placeholder:text-gray-400 max-w-[254px] rounded-full h-[26px]"
                placeholder="Nombre y apellido"
              />
            </div>
          </div>
        );

      // Paso 3: ¿Tiene despacho?
      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center flex flex-col items-center">
              <h2 className="text-[24px] font-[400] mb-2 text-tertiary">
                ¿Cuál es el nombre de su despacho?
              </h2>
              <Input
                type="text"
                value={formData.despachoName || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({
                    ...formData,
                    despachoName: value,
                    hasDespacho: value.length > 0 ? true : null,
                  });
                }}
                className="bg-white placeholder:text-gray-400 max-w-[254px] rounded-full h-[26px]"
                placeholder="Ej: Pérez & Asociados"
              />
            </div>
          </div>
        );

      // Paso 4: Información del despacho (CONDICIONAL)
      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center flex flex-col items-center">
              <h2 className="text-[24px] font-[400] mb-2 text-tertiary">
                ¿Donde se encuentra el despacho?
              </h2>
              <Input
                type="text"
                value={formData.workLocation || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({
                    ...formData,
                    workLocation: value,
                  });
                }}
                className="bg-white placeholder:text-gray-400 max-w-[254px] rounded-full h-[26px]"
                placeholder="Ej: Buenos Aires, Argentina"
              />
            </div>
          </div>
        );

      // Paso 5: ¿Cuál es su rol?
      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center flex flex-col items-center">
              <h2 className="text-[24px] font-[400] mb-2 text-tertiary">
                ¿Cuál es su rol allí?
              </h2>
              <Select
                value={formData.role || undefined}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value as any })
                }
              >
                <SelectTrigger className="bg-white max-w-[254px]">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="abogado" className="hover:bg-gray-100">
                      Abogado
                    </SelectItem>
                    <SelectItem
                      value="secretario"
                      className="hover:bg-gray-100"
                    >
                      Secretario/a
                    </SelectItem>
                    <SelectItem value="asistente" className="hover:bg-gray-100">
                      Asistente legal
                    </SelectItem>
                    <SelectItem value="otro" className="hover:bg-gray-100">
                      Otro
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      // Paso 6: Número de matrícula (CONDICIONAL - solo abogados)
      case 6:
        return (
          <div className="space-y-6">
            <div className="text-center flex flex-col items-center">
              <h2 className="text-[24px] font-[400] mb-2 text-tertiary">
                ¿Cual es su numero de matrícula?
              </h2>
              <Input
                type="text"
                value={formData.barNumber || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({
                    ...formData,
                    barNumber: value,
                  });
                }}
                className="bg-white placeholder:text-gray-400 max-w-[254px] rounded-full h-[26px]"
                placeholder="Ej: 123456"
              />
            </div>
          </div>
        );

      // Paso 7: Cuéntenos sobre usted
      case 7:
        return (
          <div className="space-y-6">
            <div className="text-center flex flex-col items-center">
              <h2 className="text-[24px] font-[400] mb-2 text-tertiary">
                Cuéntenos sobre usted
              </h2>
              <Textarea
                value={formData.bio || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({
                    ...formData,
                    bio: value,
                  });
                }}
                className="bg-white placeholder:text-gray-400   h-[26px]"
                placeholder="Ej: Abogado especializado en siniestros"
              />
            </div>
          </div>
        );

      // Paso 8: Especialización
      case 8:
        return (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-[24px] font-[400] mb-2 text-tertiary">
                ¿En que area se especializa?
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-2 max-w-[550px] mx-auto max-h-[200px] overflow-y-auto">
              {legalSpecializations.map((specialization) => (
                <label
                  key={specialization}
                  className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded-md cursor-pointer transition-colors ${
                    formData.specializations.includes(specialization)
                      ? "bg-[#E8F0FE] border-l-2 border-l-blue-600"
                      : "bg-white hover:bg-[#E8F0FE]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.specializations.includes(specialization)}
                    onChange={() => handleSpecializationToggle(specialization)}
                    className="sr-only"
                  />
                  {/* Radio button indicator */}
                  <div className="flex items-center justify-center w-4 h-4 relative flex-shrink-0">
                    <div className="w-4 h-4 rounded-full border-1 border-gray-200" />
                    {formData.specializations.includes(specialization) && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-left leading-tight">
                    {specialization}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );

      // Paso 9: Despedida
      case 9:
        return (
          <div className="space-y-6">
            <div className="text-center flex flex-col items-center">
              <h2 className="text-[24px] font-[400] mb-2 text-tertiary">
                ¡Gracias por responder!
              </h2>
              <p className="text-black mb-10 text-[14px]">
                Empecemos a trabajar juntos
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen  flex items-center justify-center p-4">
      <div className=" h-[385px] w-[669px] relative bg-[#F4F7FC] rounded-[8px] flex flex-col justify-start items-center ">
        {/* Progress indicator */}
        <div
          className={`${currentStep === 8 ? "mb-10" : "mb-20"} mt-2 w-full px-8`}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-600">
              Paso {currentStep} de 9
            </span>
            <span className="text-xs text-gray-600">
              {Math.round((currentStep / 9) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-tertiary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 9) * 100}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        {renderStep()}

        {/* Navigation buttons */}
        <div className="flex flex-col justify-between mt-8">
          {currentStep === 9 ? (
            <Button
              onClick={handleComplete}
              disabled={isLoading}
              className="bg-tertiary rounded-[8px] text-white hover:bg-tertiary/90 !px-20"
              size={"lg"}
            >
              {isLoading ? "Completando..." : "Ingresar"}
            </Button>
          ) : currentStep > 1 ? (
            <>
              <Button
                onClick={handleNext}
                className="bg-white flex gap-1 text-[14px]  text-black hover:bg-white/90 !py-1 !px-15"
                disabled={
                  (currentStep === 2 && !formData.fullName) ||
                  (currentStep === 3 && !formData.despachoName) ||
                  (currentStep === 5 && formData.role === null)
                }
              >
                Siguiente
                <CircleArrowRight className=" text-tertiary " size={10} />
              </Button>
              {currentStep === 3 && (
                <Button
                  variant={"ghost"}
                  size={"sm"}
                  onClick={() => {
                    setFormData({
                      ...formData,
                      hasDespacho: false,
                      despachoName: "",
                    });
                    setCurrentStep(7);
                  }}
                  className="text-blue-500 !text-[12px]"
                >
                  Soy autonomo
                </Button>
              )}
              {currentStep === 4 && (
                <Button
                  variant={"ghost"}
                  size={"sm"}
                  onClick={() => {
                    setFormData({
                      ...formData,
                      hasDespacho: false,
                      despachoName: "",
                    });
                    handleNext();
                  }}
                  className="text-blue-500 !text-[12px]"
                >
                  Omitir pregunta
                </Button>
              )}
              {currentStep === 6 && (
                <Button
                  variant={"ghost"}
                  size={"sm"}
                  onClick={() => {
                    setFormData({
                      ...formData,
                      hasDespacho: false,
                      barNumber: "",
                    });
                    handleNext();
                  }}
                  className="text-blue-500 !text-[12px]"
                >
                  Prefiero no agregarlo
                </Button>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
