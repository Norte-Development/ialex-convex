import { useCase } from "@/context/CaseContext";
import CaseLayout from "@/components/Cases/CaseLayout";
import CaseTeamsSummary from "../../components/Cases/CaseTeamsSummary";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { FileText, Users, Plus } from "lucide-react";
import { Link } from "react-router-dom";

export default function CaseDetailPage() {
  const { currentCase } = useCase();

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "closed":
        return "bg-gray-100 text-gray-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Activo";
      case "closed":
        return "Cerrado";
      case "pending":
        return "Pendiente";
      default:
        return status;
    }
  };

  if (!currentCase) {
    return (
      <CaseLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Cargando caso...</div>
        </div>
      </CaseLayout>
    );
  }

  return (
    <CaseLayout>
      <div className="space-y-6 min-h-screen w-full   pb-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">
            {currentCase.title}
          </h1>
          {currentCase.description && (
            <p className="text-gray-600 text-lg">{currentCase.description}</p>
          )}
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={getStatusColor(currentCase.status)}
            >
              {getStatusText(currentCase.status)}
            </Badge>
            <span className="text-sm text-gray-500">
              Creado el {formatDate(currentCase._creationTime)}
            </span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link to={`/caso/${currentCase._id}/clientes`}>
                <Button
                  variant="outline"
                  className="w-full h-20 flex flex-col gap-2"
                >
                  <Users className="h-6 w-6" />
                  <span>Gestionar Clientes</span>
                </Button>
              </Link>
              <Link to={`/caso/${currentCase._id}/equipos`}>
                <Button
                  variant="outline"
                  className="w-full h-20 flex flex-col gap-2"
                >
                  <Users className="h-6 w-6" />
                  <span>Gestionar Equipos</span>
                </Button>
              </Link>
              <Link to={`/caso/${currentCase._id}/acuerdos`}>
                <Button
                  variant="outline"
                  className="w-full h-20 flex flex-col gap-2"
                >
                  <FileText className="h-6 w-6" />
                  <span>Ver Acuerdos</span>
                </Button>
              </Link>
              <Link to={`/caso/${currentCase._id}/modelos`}>
                <Button
                  variant="outline"
                  className="w-full h-20 flex flex-col gap-2"
                >
                  <FileText className="h-6 w-6" />
                  <span>Modelos</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Información del Caso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Estado</p>
                  <Badge
                    variant="outline"
                    className={getStatusColor(currentCase.status)}
                  >
                    {getStatusText(currentCase.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Fecha de Creación
                  </p>
                  <p className="text-sm">
                    {formatDate(currentCase._creationTime)}
                  </p>
                </div>
                {currentCase.startDate && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Fecha de Inicio
                    </p>
                    <p className="text-sm">
                      {formatDate(currentCase.startDate)}
                    </p>
                  </div>
                )}
                {currentCase.endDate && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Fecha de Fin
                    </p>
                    <p className="text-sm">{formatDate(currentCase.endDate)}</p>
                  </div>
                )}
              </div>

              {currentCase.tags && currentCase.tags.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">
                    Etiquetas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {currentCase.tags.map((tag: string, index: number) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="text-xs"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <CaseTeamsSummary caseId={currentCase._id} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>¿Por dónde empezar?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-medium">Configuración Inicial</h4>
                <div className="space-y-2">
                  <Link to={`/caso/${currentCase._id}/clientes`}>
                    <Button variant="ghost" className="w-full justify-start">
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar clientes al caso
                    </Button>
                  </Link>
                  <Link to={`/caso/${currentCase._id}/equipos`}>
                    <Button variant="ghost" className="w-full justify-start">
                      <Plus className="h-4 w-4 mr-2" />
                      Asignar equipos de trabajo
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-medium">Herramientas</h4>
                <div className="space-y-2">
                  <Link to={`/caso/${currentCase._id}/modelos`}>
                    <Button variant="ghost" className="w-full justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      Usar modelos de documentos
                    </Button>
                  </Link>
                  <Link to={`/caso/${currentCase._id}/base-de-datos`}>
                    <Button variant="ghost" className="w-full justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      Consultar base de datos legal
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </CaseLayout>
  );
}
