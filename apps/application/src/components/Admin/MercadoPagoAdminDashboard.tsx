import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, Users, AlertTriangle, Plus, Edit, Trash2, Upload, FileText } from "lucide-react";
import { toast } from "sonner";

interface MercadoPagoSubscription {
  _id: Id<"mercadopagoSubscriptions">;
  userId: Id<"users">;
  mpSubscriptionId: string;
  mpCustomerId: string;
  plan: "premium_individual" | "premium_team" | "enterprise";
  status: "active" | "paused" | "cancelled" | "expired";
  amount: number;
  currency: string;
  billingCycle: "monthly" | "yearly";
  startDate: number;
  nextBillingDate: number;
  endDate?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  user: {
    _id: Id<"users">;
    name: string;
    email: string;
  } | null;
}

export function MercadoPagoAdminDashboard() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<MercadoPagoSubscription | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    total: number;
    preview: Array<{
      name: string;
      email: string;
      status: string;
      amount: number;
      currency: string;
      billingCycle: string;
      nextPaymentDate: string;
    }>;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Queries
  const subscriptions = useQuery(api.functions.mercadopagoAdmin.getAllMercadoPagoSubscriptions);
  const stats = useQuery(api.functions.mercadopagoAdmin.getMercadoPagoStats);
  const expiringSoon = useQuery(api.functions.mercadopagoAdmin.getExpiringSoon);

  // Mutations
  const createSubscription = useMutation(api.functions.mercadopagoAdmin.createMercadoPagoSubscription);
  const updateStatus = useMutation(api.functions.mercadopagoAdmin.updateMercadoPagoSubscriptionStatus);
  const updateBillingDate = useMutation(api.functions.mercadopagoAdmin.updateMercadoPagoBillingDate);
  const deleteSubscription = useMutation(api.functions.mercadopagoAdmin.deleteMercadoPagoSubscription);
  const importCSV = useMutation(api.functions.mercadopagoImport.importMercadoPagoCSV);
  const createPlaceholderUsers = useMutation(api.functions.mercadopagoImport.createPlaceholderUsers);
  const getImportPreview = useMutation(api.functions.mercadopagoImport.getImportPreview);

  const handleCreateSubscription = async (formData: FormData) => {
    try {
      await createSubscription({
        userId: formData.get("userId") as Id<"users">,
        mpSubscriptionId: formData.get("mpSubscriptionId") as string,
        mpCustomerId: formData.get("mpCustomerId") as string,
        plan: formData.get("plan") as "premium_individual" | "premium_team" | "enterprise",
        amount: parseInt(formData.get("amount") as string),
        currency: formData.get("currency") as string,
        billingCycle: formData.get("billingCycle") as "monthly" | "yearly",
        startDate: new Date(formData.get("startDate") as string).getTime(),
        nextBillingDate: new Date(formData.get("nextBillingDate") as string).getTime(),
        notes: formData.get("notes") as string || undefined,
      });
      
      toast.success("Suscripción creada exitosamente");
      setIsCreateDialogOpen(false);
    } catch (error) {
      toast.error(`Error al crear suscripción: ${error}`);
    }
  };

  const handleUpdateStatus = async (subscriptionId: Id<"mercadopagoSubscriptions">, status: string, notes?: string) => {
    try {
      await updateStatus({ subscriptionId, status: status as any, notes });
      toast.success("Estado actualizado exitosamente");
    } catch (error) {
      toast.error(`Error al actualizar estado: ${error}`);
    }
  };

  const handleUpdateBillingDate = async (subscriptionId: Id<"mercadopagoSubscriptions">, nextBillingDate: number, notes?: string) => {
    try {
      await updateBillingDate({ subscriptionId, nextBillingDate, notes });
      toast.success("Fecha de facturación actualizada exitosamente");
    } catch (error) {
      toast.error(`Error al actualizar fecha: ${error}`);
    }
  };

  const handleDeleteSubscription = async (subscriptionId: Id<"mercadopagoSubscriptions">) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta suscripción?")) return;
    
    try {
      await deleteSubscription({ subscriptionId });
      toast.success("Suscripción eliminada exitosamente");
    } catch (error) {
      toast.error(`Error al eliminar suscripción: ${error}`);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    
    try {
      const content = await file.text();
      const preview = await getImportPreview({ csvContent: content });
      setImportPreview(preview);
    } catch (error) {
      toast.error(`Error al procesar archivo: ${error}`);
    }
  };

  const handleImportCSV = async () => {
    if (!csvFile || !importPreview) return;

    setIsImporting(true);
    try {
      const content = await csvFile.text();
      
      // First create placeholder users
      await createPlaceholderUsers({ csvContent: content });
      
      // Then import subscriptions
      const importResult = await importCSV({ 
        csvContent: content,
        adminUserId: "jx7d2qe3tz4t41rf0zqmx0bdy17tah7m" as Id<"users"> // TODO: Get actual admin user ID
      });
      
      toast.success(`Importación completada: ${importResult.imported} suscripciones importadas, ${importResult.skipped} omitidas, ${importResult.errors} errores`);
      
      // Reset form
      setCsvFile(null);
      setImportPreview(null);
      setIsImportDialogOpen(false);
      
    } catch (error) {
      toast.error(`Error durante la importación: ${error}`);
    } finally {
      setIsImporting(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency === 'ARS' ? 'ARS' : 'USD',
    }).format(amount / 100);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('es-AR');
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "default",
      paused: "secondary", 
      cancelled: "destructive",
      expired: "outline"
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "outline"}>
        {status}
      </Badge>
    );
  };

  if (!subscriptions || !stats) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">MercadoPago Subscriptions</h1>
          <p className="text-muted-foreground">
            Administración manual de suscripciones MercadoPago
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Suscripción
              </Button>
            </DialogTrigger>
          </Dialog>
          
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Importar CSV
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Nueva Suscripción</DialogTitle>
              <DialogDescription>
                Agregar una nueva suscripción MercadoPago manualmente
              </DialogDescription>
            </DialogHeader>
            <form action={handleCreateSubscription} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="userId">User ID</Label>
                  <Input id="userId" name="userId" required />
                </div>
                <div>
                  <Label htmlFor="mpSubscriptionId">MercadoPago Subscription ID</Label>
                  <Input id="mpSubscriptionId" name="mpSubscriptionId" required />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mpCustomerId">MercadoPago Customer ID</Label>
                  <Input id="mpCustomerId" name="mpCustomerId" required />
                </div>
                <div>
                  <Label htmlFor="plan">Plan</Label>
                  <Select name="plan" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="premium_individual">Premium Individual</SelectItem>
                      <SelectItem value="premium_team">Premium Team</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="amount">Monto (centavos)</Label>
                  <Input id="amount" name="amount" type="number" required />
                </div>
                <div>
                  <Label htmlFor="currency">Moneda</Label>
                  <Select name="currency" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Moneda" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">ARS</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="billingCycle">Ciclo de Facturación</Label>
                  <Select name="billingCycle" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Ciclo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensual</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Fecha de Inicio</Label>
                  <Input id="startDate" name="startDate" type="date" required />
                </div>
                <div>
                  <Label htmlFor="nextBillingDate">Próxima Facturación</Label>
                  <Input id="nextBillingDate" name="nextBillingDate" type="date" required />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notas</Label>
                <Textarea id="notes" name="notes" placeholder="Notas adicionales..." />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Crear Suscripción</Button>
              </div>
            </form>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Suscripciones</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.active || 0} activas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Mensuales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.monthlyRevenue || 0, 'ARS')}
            </div>
            <p className="text-xs text-muted-foreground">
              Suscripciones mensuales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Anuales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.yearlyRevenue || 0, 'ARS')}
            </div>
            <p className="text-xs text-muted-foreground">
              Suscripciones anuales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiran Pronto</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiringSoon?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Próximos 7 días
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Expiring Soon Alert */}
      {expiringSoon && expiringSoon.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{expiringSoon.length}</strong> suscripciones expiran en los próximos 7 días.
            Revisa las fechas de facturación.
          </AlertDescription>
        </Alert>
      )}

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Todas las Suscripciones</CardTitle>
          <CardDescription>
            Lista completa de suscripciones MercadoPago
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Ciclo</TableHead>
                <TableHead>Próxima Facturación</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions?.map((subscription) => (
                <TableRow key={subscription._id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{subscription.user?.name || 'Usuario no encontrado'}</div>
                      <div className="text-sm text-muted-foreground">{subscription.user?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{subscription.plan}</Badge>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(subscription.status)}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(subscription.amount, subscription.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{subscription.billingCycle}</Badge>
                  </TableCell>
                  <TableCell>
                    {formatDate(subscription.nextBillingDate)}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedSubscription(subscription);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteSubscription(subscription._id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Suscripción</DialogTitle>
            <DialogDescription>
              Actualizar estado y fechas de la suscripción
            </DialogDescription>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-4">
              <div>
                <Label>Usuario</Label>
                <p className="text-sm font-medium">
                  {selectedSubscription.user?.name} ({selectedSubscription.user?.email})
                </p>
              </div>
              
              <div>
                <Label>Plan</Label>
                <p className="text-sm">{selectedSubscription.plan}</p>
              </div>

              <div>
                <Label>Estado Actual</Label>
                <div className="mt-2">
                  {getStatusBadge(selectedSubscription.status)}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cambiar Estado</Label>
                <div className="flex space-x-2">
                  {['active', 'paused', 'cancelled', 'expired'].map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={selectedSubscription.status === status ? "default" : "outline"}
                      onClick={() => handleUpdateStatus(selectedSubscription._id, status)}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Próxima Facturación</Label>
                <p className="text-sm">{formatDate(selectedSubscription.nextBillingDate)}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    const newDate = new Date();
                    newDate.setMonth(newDate.getMonth() + 1);
                    handleUpdateBillingDate(selectedSubscription._id, newDate.getTime());
                  }}
                >
                  Extender 1 mes
                </Button>
              </div>

              <div>
                <Label>Notas</Label>
                <Textarea
                  placeholder="Notas adicionales..."
                  defaultValue={selectedSubscription.notes || ''}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Importar Suscripciones desde CSV</DialogTitle>
            <DialogDescription>
              Importa suscripciones MercadoPago desde un archivo CSV
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="csv-file">Archivo CSV</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Selecciona el archivo CSV exportado desde MercadoPago
              </p>
            </div>

            {importPreview && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">
                    Vista previa: {importPreview.total} suscripciones encontradas
                  </span>
                </div>
                
                <div className="max-h-60 overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Ciclo</TableHead>
                        <TableHead>Próximo Pago</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreview.preview.slice(0, 10).map((item, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>{item.email}</TableCell>
                          <TableCell>
                            <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatCurrency(item.amount, item.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.billingCycle}</Badge>
                          </TableCell>
                          <TableCell>
                            {item.nextPaymentDate ? formatDate(new Date(item.nextPaymentDate).getTime()) : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {importPreview.preview.length > 10 && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      ... y {importPreview.preview.length - 10} más
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCsvFile(null);
                      setImportPreview(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleImportCSV}
                    disabled={isImporting}
                  >
                    {isImporting ? 'Importando...' : 'Importar Suscripciones'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
