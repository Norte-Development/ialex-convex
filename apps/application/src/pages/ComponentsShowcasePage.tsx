import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import WindowModal from "@/components/ui/WindowModal";
import NavBar from "@/components/Layout/Navbar/NavBar";
import ModelsTable from "@/components/Models/ModelsTable";
import EventCard from "@/components/Home/NewCaseCard";
import EventDateCard from "@/components/Home/EventDateCard";
import { Badge } from "@/components/ui/badge";

export default function ComponentsShowcasePage() {
  const [selectedRadio, setSelectedRadio] = useState("");
  const [selectedSelect, setSelectedSelect] = useState("");
  const [isChecked, setIsChecked] = useState(false);
  const [isIndeterminate, setIsIndeterminate] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"success" | "error" | "info">(
    "success",
  );

  //   // Mock data para las tablas
  //   const mockCases = [
  //     {
  //       _id: "1" as any,
  //       _creationTime: Date.now(),
  //       title: "Caso de Ejemplo 1",
  //       description: "Descripción del caso 1",
  //       status: "en progreso" as const,
  //       priority: "high" as const,
  //       category: "Civil",
  //       startDate: Date.now(),
  //       assignedLawyer: "lawyer1" as any,
  //       createdBy: "user1" as any,
  //       estimatedHours: 40,
  //       actualHours: 25,
  //       isArchived: false,
  //       tags: ["urgente", "civil"],
  //     },
  //     {
  //       _id: "2" as any,
  //       _creationTime: Date.now(),
  //       title: "Caso de Ejemplo 2",
  //       description: "Descripción del caso 2",
  //       status: "pendiente" as const,
  //       priority: "medium" as const,
  //       category: "Penal",
  //       startDate: Date.now(),
  //       assignedLawyer: "lawyer2" as any,
  //       createdBy: "user2" as any,
  //       estimatedHours: 60,
  //       actualHours: 10,
  //       isArchived: false,
  //       tags: ["penal", "revisión"],
  //     },
  //   ];

  const mockModels = [
    {
      _id: "model1",
      title: "Contrato de Arrendamiento",
      category: "Contratos",
      type: "Plantilla",
    },
    {
      _id: "model2",
      title: "Demanda Civil",
      category: "Litigios",
      type: "Documento",
    },
    {
      _id: "model3",
      title: "Poder Notarial",
      category: "Notarial",
      type: "Formulario",
    },
  ];

  const mockEvents = [
    {
      _id: "event1",
      name: "Audiencia Preliminar",
      date: new Date("2025-10-15"),
      start: "09:00",
      end: "11:00",
    },
    {
      _id: "event2",
      name: "Reunión con Cliente",
      date: new Date("2025-10-20"),
      start: "14:00",
      end: "16:00",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NavBar */}
      <NavBar />

      <div className="pt-20 px-8 space-y-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Showcase de Componentes iAlex
          </h1>
          <p className="text-lg text-gray-600">
            Demostración de todos los componentes UI disponibles
          </p>
        </div>

        {/* Sección de Botones */}
        <section className="bg-white p-8 rounded-lg shadow-sm">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">Botones</h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="default">Default</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="outline_secondary">Outline Secondary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
          <div className="flex flex-wrap gap-4 mt-4">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon">🔍</Button>
          </div>
        </section>

        {/* Sección de Inputs */}
        <section className="bg-white p-8 rounded-lg shadow-sm">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">
            Controles de Entrada
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Checkbox */}
            <div>
              <h3 className="text-lg font-medium mb-4">Checkbox</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="check1"
                    checked={isChecked}
                    onCheckedChange={(checked) =>
                      setIsChecked(checked === true)
                    }
                  />
                  <label htmlFor="check1" className="text-sm">
                    Checkbox normal
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="check2"
                    indeterminate={true}
                    onCheckedChange={(checked) =>
                      setIsIndeterminate(checked === "indeterminate")
                    }
                  />
                  <label htmlFor="check2" className="text-sm">
                    Checkbox indeterminado
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="check3" disabled />
                  <label htmlFor="check3" className="text-sm">
                    Checkbox deshabilitado
                  </label>
                </div>
              </div>
            </div>

            {/* Radio Group */}
            <div>
              <h3 className="text-lg font-medium mb-4">Radio Group</h3>
              <RadioGroup
                value={selectedRadio}
                onValueChange={setSelectedRadio}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="option1" id="radio1" />
                  <label htmlFor="radio1" className="text-sm">
                    Opción 1
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="option2" id="radio2" />
                  <label htmlFor="radio2" className="text-sm">
                    Opción 2
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="option3"
                    id="radio3"
                    variant="secondary"
                  />
                  <label htmlFor="radio3" className="text-sm">
                    Opción 3 (Secondary)
                  </label>
                </div>
              </RadioGroup>
            </div>

            {/* Select */}
            <div>
              <h3 className="text-lg font-medium mb-4">Select</h3>
              <div className="space-y-3">
                <Select
                  value={selectedSelect}
                  onValueChange={setSelectedSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una opción" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="item1">Item 1</SelectItem>
                    <SelectItem value="item2">Item 2</SelectItem>
                    <SelectItem value="item3">Item 3</SelectItem>
                  </SelectContent>
                </Select>

                <Select>
                  <SelectTrigger variant="tertiary" size="sm">
                    <SelectValue placeholder="Select Terciario" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="item1" variant="tertiary">
                      Item 1
                    </SelectItem>
                    <SelectItem value="item2" variant="tertiary">
                      Item 2
                    </SelectItem>
                    <SelectItem value="item3" variant="tertiary">
                      Item 3
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </section>

        {/* Sección de Modales */}
        <section className="bg-white p-8 rounded-lg shadow-sm">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">Modales</h2>
          <div className="flex gap-4 mb-6">
            <Button
              onClick={() => {
                setModalType("success");
                setShowModal(true);
              }}
            >
              Modal de Éxito
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setModalType("error");
                setShowModal(true);
              }}
            >
              Modal de Error
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setModalType("info");
                setShowModal(true);
              }}
            >
              Modal de Info
            </Button>
          </div>

          {showModal && (
            <div className="flex justify-center">
              <WindowModal
                type={modalType}
                title={
                  modalType === "success"
                    ? "¡Operación exitosa!"
                    : modalType === "error"
                      ? "Error en la operación"
                      : "Información importante"
                }
                description={
                  modalType === "success"
                    ? "La operación se completó correctamente."
                    : modalType === "error"
                      ? "Ocurrió un error durante el proceso."
                      : "Esta es información relevante que debes conocer."
                }
              />
            </div>
          )}
        </section>

        {/* Sección de Tarjetas de Eventos */}
        <section className="bg-white p-8 rounded-lg shadow-sm">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">
            Tarjetas de Eventos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Event Cards</h3>
              <div className="space-y-4">
                {mockEvents.map((event) => (
                  <EventCard key={event._id} event={event} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">Event Date Cards</h3>
              <div className="space-y-4">
                {mockEvents.map((event) => (
                  <EventDateCard key={event._id} event={event} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Sección de Tablas */}
        <section className="bg-white p-8 rounded-lg shadow-sm">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">Tablas</h2>

          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-medium mb-4">Tabla de Modelos</h3>
              <ModelsTable models={mockModels} />
            </div>
          </div>
        </section>

        {/* Sección de Badges */}
        <section className="bg-white p-8 rounded-lg shadow-sm">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">Badges</h2>
          <div className="flex flex-wrap gap-4">
            <Badge variant="basic">Basic</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
        </section>

        {/* Información adicional */}
        <section className="bg-white p-8 rounded-lg shadow-sm">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">
            Información de Desarrollo
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium mb-3">
                Componentes Incluidos:
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Button - Botones con múltiples variantes</li>
                <li>Checkbox - Con soporte para estado indeterminado</li>
                <li>RadioGroup - Grupos de radio buttons</li>
                <li>Select - Dropdown con opciones múltiples</li>
                <li>WindowModal - Modales para notificaciones</li>
                <li>EventCard & EventDateCard - Tarjetas de eventos</li>
                <li>CaseTable & ModelsTable - Tablas de datos</li>
                <li>NavBar - Barra de navegación</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-3">Tecnologías:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>React + TypeScript</li>
                <li>Radix UI para componentes base</li>
                <li>Tailwind CSS para estilos</li>
                <li>Class Variance Authority para variantes</li>
                <li>Lucide React para iconos</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
