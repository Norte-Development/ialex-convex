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

    // Paso 7 → Paso 5 o Paso 6 (depende de role)
    if (currentStep === 7) {
      if (formData.role === "abogado") {
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
      // Mockeo de datos a enviar al backend
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

      console.log("📤 Datos de onboarding a enviar:", onboardingData);

      // TODO: Reemplazar con la llamada real al backend
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
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">
                Especialidades Legales
              </h2>
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

      // Paso 9: Despedida
      case 9:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">¡Todo listo!</h2>
              <p className="text-gray-600">
                Tu perfil ha sido configurado exitosamente.
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Resumen de tu perfil:</h3>
              <div className="text-sm text-gray-600 space-y-1">
                {formData.fullName && (
                  <p>
                    <strong>Nombre:</strong> {formData.fullName}
                  </p>
                )}
                {formData.despachoName && (
                  <p>
                    <strong>Despacho:</strong> {formData.despachoName}
                  </p>
                )}
                {formData.hasDespacho === false && (
                  <p>
                    <strong>Tipo:</strong> Autónomo
                  </p>
                )}
                {formData.role && (
                  <p>
                    <strong>Rol:</strong> {formData.role}
                  </p>
                )}
                {formData.barNumber && (
                  <p>
                    <strong>Matrícula:</strong> {formData.barNumber}
                  </p>
                )}
                {formData.firmName && (
                  <p>
                    <strong>Firma:</strong> {formData.firmName}
                  </p>
                )}
                {formData.workLocation && (
                  <p>
                    <strong>Ubicación:</strong> {formData.workLocation}
                  </p>
                )}
                {formData.experienceYears && (
                  <p>
                    <strong>Experiencia:</strong> {formData.experienceYears}{" "}
                    años
                  </p>
                )}
                {formData.specializations.length > 0 && (
                  <p>
                    <strong>Especialidades:</strong>{" "}
                    {formData.specializations.join(", ")}
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen  flex items-center justify-center p-4">
      <div className=" h-[385px] w-[669px] relative bg-[#F4F7FC] rounded-[8px] flex flex-col justify-center items-center ">
        {/* Progress indicator */}
        <Button
          className="text-black absolute top-4 left-4"
          size={"sm"}
          onClick={() => handleBack()}
        >
          {" "}
          Anterior
        </Button>
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
              {isLoading ? "Completando..." : "Ingresar a iAlex"}
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
                    handleNext();
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
