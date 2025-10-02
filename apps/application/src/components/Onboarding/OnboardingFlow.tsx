import React, { useState, useEffect } from "react";
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
import { toast } from "sonner";

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
      // Construir objeto solo con campos que tienen valores válidos (no null, no undefined, no strings vacíos)
      const onboardingData: any = {
        onboardingStep: 9,
        isOnboardingComplete: true,
      };

      // Solo agregar campos con valores válidos
      if (formData.fullName) onboardingData.fullName = formData.fullName;
      if (formData.hasDespacho !== null)
        onboardingData.hasDespacho = formData.hasDespacho;
      if (formData.despachoName)
        onboardingData.despachoName = formData.despachoName;
      if (formData.firmName) onboardingData.firmName = formData.firmName;
      if (formData.workLocation)
        onboardingData.workLocation = formData.workLocation;
      if (formData.role) onboardingData.role = formData.role;
      if (formData.barNumber) onboardingData.barNumber = formData.barNumber;
      if (formData.experienceYears)
        onboardingData.experienceYears = formData.experienceYears;
      if (formData.bio) onboardingData.bio = formData.bio;
      if (formData.specializations && formData.specializations.length > 0) {
        onboardingData.specializations = formData.specializations;
      }

      await updateOnboarding(onboardingData);

      console.log("✅ Onboarding completado exitosamente");
    } catch (error) {
      toast.error(`❌ Error completing onboarding: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Validar si el botón "Siguiente" debe estar deshabilitado
  const isNextDisabled = () => {
    if (currentStep === 2 && !formData.fullName) return true;
    if (currentStep === 3 && !formData.despachoName) return true;
    if (currentStep === 5 && formData.role === null) return true;
    return false;
  };

  // Manejar tecla Enter
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();

        if (currentStep === 9) {
          if (!isLoading) {
            handleComplete();
          }
        } else if (currentStep > 1) {
          if (!isNextDisabled()) {
            handleNext();
          }
        } else if (currentStep === 1) {
          handleNext();
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentStep, formData, isLoading]);

  const renderStep = () => {
    switch (currentStep) {
      // Paso 1: Bienvenida
      case 1:
        return (
          <div className="text-center max-w-xl  w-full">
            <h2 className="text-2xl 2xl:text-3xl font-[400] mb-3 md:mb-4 text-tertiary">
              ¡Bienvenido a iAlex!
            </h2>
            <p className="text-black mb-8 md:mb-10 text-sm md:text-base">
              Vamos a configurar su perfil profesional
            </p>
            <Button
              onClick={handleNext}
              className="bg-tertiary rounded-[8px] text-white hover:bg-tertiary/90 !px-20"
              size={"lg"}
            >
              Comenzar
            </Button>
          </div>
        );

      // Paso 2: Información básica
      case 2:
        return (
          <div className="text-center flex flex-col items-center max-w-xl w-full">
            <h2 className="text-[24px] 2xl:text-3xl font-[400] mb-4 text-tertiary">
              ¿Cuál es su nombre?
            </h2>
            <Input
              type="text"
              value={formData.fullName || ""}
              onChange={(e) =>
                setFormData({ ...formData, fullName: e.target.value })
              }
              className="bg-white placeholder:text-gray-400 max-w-[254px] 2xl:w-full  rounded-full h-[26px]"
              placeholder="Nombre y apellido"
            />
          </div>
        );

      // Paso 3: ¿Tiene despacho?
      case 3:
        return (
          <div className="text-center flex flex-col items-center max-w-xl w-full">
            <h2 className="text-[24px] 2xl:text-3xl font-[400] mb-4 text-tertiary">
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
              className="bg-white placeholder:text-gray-400 max-w-[254px] 2xl:w-full  rounded-full h-[26px]"
              placeholder="Ej: Pérez & Asociados"
            />
          </div>
        );

      // Paso 4: Información del despacho (CONDICIONAL)
      case 4:
        return (
          <div className="text-center flex flex-col items-center max-w-xl w-full">
            <h2 className="text-[24px] 2xl:text-3xl font-[400] mb-4 text-tertiary">
              ¿Dónde se encuentra el despacho?
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
              className="bg-white placeholder:text-gray-400 max-w-[254px] 2xl:w-full  rounded-full h-[26px]"
              placeholder="Ej: Buenos Aires, Argentina"
            />
          </div>
        );

      // Paso 5: ¿Cuál es su rol?
      case 5:
        return (
          <div className="text-center flex flex-col items-center max-w-xl w-full">
            <h2 className="text-[24px] 2xl:text-3xl font-[400] mb-4 text-tertiary">
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
                  <SelectItem value="secretario" className="hover:bg-gray-100">
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
        );

      // Paso 6: Número de matrícula (CONDICIONAL - solo abogados)
      case 6:
        return (
          <div className="text-center flex flex-col items-center max-w-xl w-full">
            <h2 className="text-[24px] 2xl:text-3xl font-[400] mb-4 text-tertiary">
              ¿Cuál es su número de matrícula?
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
              className="bg-white placeholder:text-gray-400 max-w-[254px] 2xl:w-full rounded-full h-[26px]"
              placeholder="Ej: 123456"
            />
          </div>
        );

      // Paso 7: Cuéntenos sobre usted
      case 7:
        return (
          <div className="text-center flex flex-col items-center max-w-xl w-full">
            <h2 className="text-[24px] 2xl:text-3xl font-[400] mb-4 text-tertiary">
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
              className="bg-white placeholder:text-gray-400 h-[26px] "
              placeholder="Ej: Abogado especializado en siniestros"
            />
          </div>
        );

      // Paso 8: Especialización
      case 8:
        return (
          <div className="flex flex-col items-center max-w-2xl w-full">
            <h2 className="text-[24px] 2xl:text-3xl font-[400] mb-4 text-tertiary text-center">
              ¿En qué área se especializa?
            </h2>

            <div className="grid grid-cols-3 gap-2 w-full max-w-[550px] max-h-[200px] overflow-y-auto">
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
                  <span className="text-left leading-tight ">
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
          <div className="text-center flex flex-col items-center max-w-xl w-full">
            <h2 className="text-[24px] 2xl:text-3xl font-[400] mb-4 text-tertiary">
              ¡Gracias por responder!
            </h2>
            <p className="text-black text-[14px]">
              Empecemos a trabajar juntos
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex items-center justify-center p-4">
      <div className="w-[70%] h-[60%] 2xl:w-[50%] 2xl:h-[45%] bg-[#F4F7FC] rounded-[8px] flex flex-col">
        {/* Header con Progress indicator - siempre arriba */}
        <div className="flex-shrink-0 w-full px-8 pt-2 pb-4 relative">
          <Button
            variant={"ghost"}
            className="top-10 left-2 text-[12px] text-gray-500  absolute"
            onClick={handleBack}
          >
            Volver
          </Button>
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

        {/* Step content - centrado verticalmente en el espacio restante */}
        <div className="flex-1 flex items-center justify-center px-4">
          {renderStep()}
        </div>

        {/* Navigation buttons - siempre abajo */}
        <div className="flex-shrink-0 flex flex-col items-center pb-8 px-4">
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
                disabled={isNextDisabled()}
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
                  Soy autónomo
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
