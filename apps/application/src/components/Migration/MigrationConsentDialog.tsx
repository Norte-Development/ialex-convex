// import { useState } from "react";
// import { useMutation } from "convex/react";
// import { api } from "../../../convex/_generated/api";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from "../ui/dialog";
// import { Button } from "../ui/button";
// import { Checkbox } from "../ui/checkbox";
// import { Label } from "../ui/label";
// import { AlertCircle, Database, FileText, Users, CheckCircle2 } from "lucide-react";
// import { Alert, AlertDescription } from "../ui/alert";
// import { toast } from "sonner";

// interface MigrationConsentDialogProps {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   onConsentGiven: () => void;
// }

// export function MigrationConsentDialog({
//   open,
//   onOpenChange,
//   onConsentGiven,
// }: MigrationConsentDialogProps) {
//   const [consentChecked, setConsentChecked] = useState(false);
//   const [isGivingConsent, setIsGivingConsent] = useState(false);

//   const giveMigrationConsent = useMutation(api.functions.migration.giveMigrationConsent);

//   const handleGiveConsent = async () => {
//     if (!consentChecked) {
//       toast.error("Por favor, acepta los términos para continuar");
//       return;
//     }

//     setIsGivingConsent(true);

//     try {
//       await giveMigrationConsent();
//       toast.success("Consentimiento registrado exitosamente");
//       onConsentGiven();
//       onOpenChange(false);
//     } catch (error: any) {
//       console.error("Error giving consent:", error);
//       toast.error(error.message || "Error al registrar el consentimiento");
//     } finally {
//       setIsGivingConsent(false);
//     }
//   };

//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//     <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" showCloseButton={false}>
//       <DialogHeader>
//         <DialogTitle className="flex items-center gap-2 text-2xl">
//           <Database className="h-6 w-6 text-blue-500" />
//           Migración de Datos
//         </DialogTitle>
//         <DialogDescription className="text-base mt-4">
//           Hemos actualizado nuestro sistema y necesitamos migrar tus datos a la nueva plataforma.
//         </DialogDescription>
//       </DialogHeader>

//       <div className="space-y-6 py-4 flex-1 overflow-y-auto">
//           {/* What will be migrated */}
//           <div>
//             <h3 className="font-semibold mb-3 text-lg">¿Qué se migrará?</h3>
//             <div className="grid gap-3">
//               <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
//                 <FileText className="h-5 w-5 text-blue-500 mt-0.5" />
//                 <div>
//                   <p className="font-medium">Expedientes</p>
//                   <p className="text-sm text-muted-foreground">
//                     Todos tus expedientes, incluyendo detalles, estados y fechas
//                   </p>
//                 </div>
//               </div>

//               <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
//                 <Users className="h-5 w-5 text-green-500 mt-0.5" />
//                 <div>
//                   <p className="font-medium">Clientes</p>
//                   <p className="text-sm text-muted-foreground">
//                     Información de todos tus clientes y sus datos de contacto
//                   </p>
//                 </div>
//               </div>

//               <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
//                 <Database className="h-5 w-5 text-purple-500 mt-0.5" />
//                 <div>
//                   <p className="font-medium">Documentos</p>
//                   <p className="text-sm text-muted-foreground">
//                     Todos tus documentos vinculados a expedientes y tu biblioteca personal
//                   </p>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Important notes */}
//           <Alert>
//             <AlertCircle className="h-4 w-4" />
//             <AlertDescription>
//               <div className="space-y-2 text-sm">
//                 <p className="font-semibold">Información importante:</p>
//                 <ul className="list-disc list-inside space-y-1 ml-2">
//                   <li>El proceso puede tomar varios minutos dependiendo de la cantidad de datos</li>
//                   <li>Puedes seguir usando la aplicación mientras se migran los datos</li>
//                   <li>Los archivos se migrarán de forma segura a nuestro nuevo almacenamiento</li>
//                   <li>No se eliminarán tus datos originales durante este proceso</li>
//                 </ul>
//               </div>
//             </AlertDescription>
//           </Alert>

//           {/* Consent checkbox */}
//           <div className="flex items-start space-x-3 p-4 rounded-lg border bg-blue-50">
//             <Checkbox
//               id="migration-consent"
//               checked={consentChecked}
//               onCheckedChange={(checked) => setConsentChecked(checked as boolean)}
//               className="mt-1"
//             />
//             <div className="flex-1">
//               <Label
//                 htmlFor="migration-consent"
//                 className="text-sm font-medium leading-relaxed cursor-pointer"
//               >
//                 Entiendo que mis datos serán migrados a la nueva plataforma y autorizo el inicio del
//                 proceso de migración. Confirmo que he leído y comprendo la información proporcionada.
//               </Label>
//             </div>
//           </div>
//         </div>

//         <DialogFooter className="mt-6 pt-4 border-t">
//           <Button
//             variant="outline"
//             onClick={() => onOpenChange(false)}
//             disabled={isGivingConsent}
//           >
//             Cancelar
//           </Button>
//           <Button
//             onClick={handleGiveConsent}
//             disabled={!consentChecked || isGivingConsent}
//             className="gap-2"
//           >
//             {isGivingConsent ? (
//               <>
//                 <span className="animate-spin">⏳</span>
//                 Procesando...
//               </>
//             ) : (
//               <>
//                 <CheckCircle2 className="h-4 w-4" />
//                 Autorizar Migración
//               </>
//             )}
//           </Button>
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   );
// }

