import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Users,
  Link2,
  Unlink,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  MoreHorizontal,
  UserPlus,
  Search,
  RefreshCw,
  Loader2,
  ExternalLink,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface IntervinientesPanelProps {
  caseId: Id<"cases">
}

type LinkType = "AUTO_HIGH_CONFIDENCE" | "AUTO_LOW_CONFIDENCE" | "CONFIRMED" | "MANUAL" | "IGNORED"

export function IntervinientesPanel({ caseId }: IntervinientesPanelProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [createClientDialogOpen, setCreateClientDialogOpen] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null)
  const [isRematching, setIsRematching] = useState(false)

  // Fetch intervinientes with link status
  const data = useQuery(api.intervinientes.queries.getIntervinientesForCase, {
    caseId,
  })

  // Mutations
  const confirmLink = useMutation(api.intervinientes.queries.confirmIntervinienteLink)
  const unlinkInterviniente = useMutation(api.intervinientes.queries.unlinkInterviniente)
  const ignoreInterviniente = useMutation(api.intervinientes.queries.ignoreInterviniente)
  const rematchAll = useMutation(api.intervinientes.queries.rematchParticipantsForCase)

  const handleConfirmLink = async (linkId: Id<"intervinienteClientLinks">) => {
    try {
      await confirmLink({ linkId })
      toast.success("Vínculo confirmado")
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : "Error desconocido"}`)
    }
  }

  const handleUnlink = async (linkId: Id<"intervinienteClientLinks">) => {
    try {
      await unlinkInterviniente({ linkId })
      toast.success("Vínculo eliminado")
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : "Error desconocido"}`)
    }
  }

  const handleIgnore = async (participantId: Id<"caseParticipants">) => {
    try {
      await ignoreInterviniente({ participantId })
      toast.success("Interviniente ignorado")
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : "Error desconocido"}`)
    }
  }

  const handleRematchAll = async () => {
    setIsRematching(true)
    try {
      const result = await rematchAll({ caseId })
      toast.success(
        `Procesados: ${result.processed} | Vinculados: ${result.linked} | Sugeridos: ${result.suggested}`
      )
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : "Error desconocido"}`)
    } finally {
      setIsRematching(false)
    }
  }

  const openLinkDialog = (participantId: string) => {
    setSelectedParticipant(participantId)
    setLinkDialogOpen(true)
  }

  const openCreateClientDialog = (participantId: string) => {
    setSelectedParticipant(participantId)
    setCreateClientDialogOpen(true)
  }

  if (!data) {
    return <IntervinientesSkeleton />
  }

  const { participants, summary } = data

  return (
    <div className="space-y-4">
      {/* Summary Banner */}
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-500" />
            <span className="text-sm text-gray-600">
              <strong>{summary.total}</strong> intervinientes
            </span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-700">{summary.linked} vinculados</span>
          </div>
          {summary.suggested > 0 && (
            <div className="flex items-center gap-1">
              <HelpCircle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-amber-700">{summary.suggested} sugeridos</span>
            </div>
          )}
          {summary.unlinked > 0 && (
            <div className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500">{summary.unlinked} sin vincular</span>
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRematchAll}
          disabled={isRematching}
          className="gap-2"
        >
          {isRematching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Re-vincular automáticamente
        </Button>
      </div>

      {/* Participants Table */}
      {participants.length === 0 ? (
        <EmptyState />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rol</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Identificador</TableHead>
              <TableHead>Cliente vinculado</TableHead>
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map((p) => (
              <TableRow key={p._id}>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge
                          variant={getBadgeVariant(p.mappedRole.side)}
                          className="whitespace-nowrap"
                        >
                          {p.role}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Rol local: {p.mappedRole.displayNameEs}</p>
                        <p className="text-xs text-gray-400">
                          Parte: {getSideLabel(p.mappedRole.side)}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  {p.iejp ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="font-mono text-sm text-gray-600">
                            {p.documentType && p.documentType !== "UNKNOWN"
                              ? `${p.documentType}: ${p.documentNumber}`
                              : p.iejp}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>I.E.J: {p.iejp}</p>
                          {p.documentType && <p>Tipo: {p.documentType}</p>}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <LinkStatusCell
                    link={p.link}
                    onConfirm={() => p.link && handleConfirmLink(p.link._id)}
                  />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {p.link ? (
                        <>
                          {(p.link.linkType === "AUTO_LOW_CONFIDENCE" ||
                            p.link.linkType === "AUTO_HIGH_CONFIDENCE") && (
                            <DropdownMenuItem onClick={() => handleConfirmLink(p.link!._id)}>
                              <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                              Confirmar vínculo
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openLinkDialog(p._id)}>
                            <Link2 className="mr-2 h-4 w-4" />
                            Cambiar cliente
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleUnlink(p.link!._id)}
                            className="text-red-600"
                          >
                            <Unlink className="mr-2 h-4 w-4" />
                            Desvincular
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <>
                          <DropdownMenuItem onClick={() => openLinkDialog(p._id)}>
                            <Link2 className="mr-2 h-4 w-4" />
                            Vincular a cliente existente
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openCreateClientDialog(p._id)}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Crear cliente
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleIgnore(p._id)}>
                            <XCircle className="mr-2 h-4 w-4 text-gray-400" />
                            Ignorar
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Link to Existing Client Dialog */}
      <LinkClientDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        participantId={selectedParticipant as Id<"caseParticipants"> | null}
        caseId={caseId}
      />

      {/* Create Client Dialog */}
      <CreateClientFromIntervinienteDialog
        open={createClientDialogOpen}
        onOpenChange={setCreateClientDialogOpen}
        participantId={selectedParticipant as Id<"caseParticipants"> | null}
        participants={participants}
      />
    </div>
  )
}

// Link status cell component
function LinkStatusCell({
  link,
  onConfirm,
}: {
  link?: {
    _id: Id<"intervinienteClientLinks">
    clientId: Id<"clients">
    clientName?: string
    localRole?: string
    linkType: string
    confidence?: number
    matchReason?: string
  }
  onConfirm: () => void
}) {
  if (!link) {
    return <span className="text-gray-400 text-sm">Sin vincular</span>
  }

  const linkType = link.linkType as LinkType

  if (linkType === "IGNORED") {
    return <span className="text-gray-400 text-sm">Ignorado</span>
  }

  return (
    <div className="flex items-center gap-2">
      <LinkTypeBadge type={linkType} />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={`/clientes/${link.clientId}`}
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.clientName || "Cliente"}
              <ExternalLink className="h-3 w-3" />
            </a>
          </TooltipTrigger>
          <TooltipContent>
            <p>{link.matchReason || "Vínculo manual"}</p>
            {link.confidence && (
              <p className="text-xs text-gray-400">
                Confianza: {(link.confidence * 100).toFixed(0)}%
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {linkType === "AUTO_LOW_CONFIDENCE" && (
        <Button variant="ghost" size="sm" onClick={onConfirm} className="h-6 px-2">
          <CheckCircle className="h-3 w-3 text-green-500" />
        </Button>
      )}
    </div>
  )
}

// Link type badge component
function LinkTypeBadge({ type }: { type: LinkType }) {
  const config = {
    AUTO_HIGH_CONFIDENCE: {
      icon: CheckCircle,
      label: "Auto",
      className: "bg-green-100 text-green-700",
    },
    AUTO_LOW_CONFIDENCE: {
      icon: HelpCircle,
      label: "Sugerido",
      className: "bg-amber-100 text-amber-700",
    },
    CONFIRMED: {
      icon: CheckCircle,
      label: "Confirmado",
      className: "bg-blue-100 text-blue-700",
    },
    MANUAL: {
      icon: Link2,
      label: "Manual",
      className: "bg-purple-100 text-purple-700",
    },
    IGNORED: {
      icon: XCircle,
      label: "Ignorado",
      className: "bg-gray-100 text-gray-500",
    },
  }

  const cfg = config[type]
  const Icon = cfg.icon

  return (
    <Badge variant="outline" className={cn("gap-1 text-xs", cfg.className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  )
}

// Link client dialog
function LinkClientDialog({
  open,
  onOpenChange,
  participantId,
  caseId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  participantId: Id<"caseParticipants"> | null
  caseId: Id<"cases">
}) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [isLinking, setIsLinking] = useState(false)

  const linkToClient = useMutation(api.intervinientes.queries.linkIntervinienteToClient)

  // Search clients
  const clients = useQuery(
    api.functions.clients.getClients,
    { search: searchTerm, paginationOpts: { numItems: 10 } }
  )

  const handleLink = async () => {
    if (!participantId || !selectedClientId) return

    setIsLinking(true)
    try {
      await linkToClient({
        participantId,
        clientId: selectedClientId as Id<"clients">,
      })
      toast.success("Cliente vinculado exitosamente")
      onOpenChange(false)
      setSelectedClientId(null)
      setSearchTerm("")
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : "Error desconocido"}`)
    } finally {
      setIsLinking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Vincular a cliente existente</DialogTitle>
          <DialogDescription>
            Busca y selecciona el cliente que corresponde a este interviniente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, DNI o CUIT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto rounded-lg border">
            {clients?.page.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                No se encontraron clientes
              </div>
            ) : (
              <div className="divide-y">
                {clients?.page.map((client) => (
                  <button
                    key={client._id}
                    type="button"
                    className={cn(
                      "w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors",
                      selectedClientId === client._id && "bg-blue-50"
                    )}
                    onClick={() => setSelectedClientId(client._id)}
                  >
                    <div className="font-medium">{client.displayName}</div>
                    <div className="text-sm text-gray-500">
                      {client.dni && `DNI: ${client.dni}`}
                      {client.dni && client.cuit && " | "}
                      {client.cuit && `CUIT: ${client.cuit}`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleLink} disabled={!selectedClientId || isLinking}>
            {isLinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Create client from interviniente dialog
function CreateClientFromIntervinienteDialog({
  open,
  onOpenChange,
  participantId,
  participants,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  participantId: Id<"caseParticipants"> | null
  participants: Array<{
    _id: Id<"caseParticipants">
    name: string
    iejp?: string
    documentType?: string
    documentNumber?: string
  }>
}) {
  const [naturaleza, setNaturaleza] = useState<"humana" | "juridica">("humana")
  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    cuit: "",
    razonSocial: "",
    actividadEconomica: "sin_actividad" as const,
    email: "",
    phone: "",
  })
  const [isCreating, setIsCreating] = useState(false)

  const createClient = useMutation(api.intervinientes.queries.createClientFromInterviniente)

  // Pre-fill form when participant changes
  const participant = participants.find((p) => p._id === participantId)

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && participant) {
      // Try to parse name into nombre/apellido
      const nameParts = participant.name.split(",").map((s) => s.trim())
      if (nameParts.length === 2) {
        setFormData((prev) => ({
          ...prev,
          apellido: nameParts[0],
          nombre: nameParts[1],
          dni: participant.documentType === "DNI" ? participant.documentNumber || "" : "",
          cuit:
            participant.documentType === "CUIT" || participant.documentType === "CUIL"
              ? participant.documentNumber || ""
              : "",
        }))
      } else {
        // Could be a company name
        setFormData((prev) => ({
          ...prev,
          razonSocial: participant.name,
          cuit:
            participant.documentType === "CUIT"
              ? participant.documentNumber || ""
              : "",
        }))
        setNaturaleza("juridica")
      }
    }
    onOpenChange(isOpen)
  }

  const handleCreate = async () => {
    if (!participantId) return

    setIsCreating(true)
    try {
      await createClient({
        participantId,
        naturalezaJuridica: naturaleza,
        nombre: naturaleza === "humana" ? formData.nombre : undefined,
        apellido: naturaleza === "humana" ? formData.apellido : undefined,
        dni: naturaleza === "humana" ? formData.dni : undefined,
        actividadEconomica: naturaleza === "humana" ? formData.actividadEconomica : undefined,
        razonSocial: naturaleza === "juridica" ? formData.razonSocial : undefined,
        cuit: formData.cuit || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
      })
      toast.success("Cliente creado y vinculado exitosamente")
      onOpenChange(false)
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : "Error desconocido"}`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear cliente desde interviniente</DialogTitle>
          <DialogDescription>
            Los datos del interviniente se usarán para pre-llenar el formulario.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Naturaleza juridica selector */}
          <div className="space-y-2">
            <Label>Tipo de persona</Label>
            <Select
              value={naturaleza}
              onValueChange={(v) => setNaturaleza(v as "humana" | "juridica")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="humana">Persona humana</SelectItem>
                <SelectItem value="juridica">Persona jurídica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {naturaleza === "humana" ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Apellido *</Label>
                  <Input
                    value={formData.apellido}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, apellido: e.target.value }))
                    }
                    placeholder="García"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, nombre: e.target.value }))
                    }
                    placeholder="Juan"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>DNI *</Label>
                <Input
                  value={formData.dni}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, dni: e.target.value }))
                  }
                  placeholder="12.345.678"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Razón Social *</Label>
                <Input
                  value={formData.razonSocial}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, razonSocial: e.target.value }))
                  }
                  placeholder="Empresa S.A."
                />
              </div>
              <div className="space-y-2">
                <Label>CUIT *</Label>
                <Input
                  value={formData.cuit}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, cuit: e.target.value }))
                  }
                  placeholder="30-12345678-9"
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="email@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="+54 11 1234-5678"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear y vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Helper functions
function getBadgeVariant(side: string): "default" | "secondary" | "outline" | "destructive" {
  switch (side) {
    case "ACTOR_SIDE":
      return "default"
    case "DEMANDADO_SIDE":
      return "secondary"
    case "JUDICIAL":
      return "outline"
    default:
      return "outline"
  }
}

function getSideLabel(side: string): string {
  switch (side) {
    case "ACTOR_SIDE":
      return "Parte Actora"
    case "DEMANDADO_SIDE":
      return "Parte Demandada"
    case "JUDICIAL":
      return "Judicial"
    case "NEUTRAL":
      return "Neutral"
    default:
      return side
  }
}

function IntervinientesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      <Users size={48} className="mb-4 opacity-20" />
      <p>No hay intervinientes sincronizados</p>
      <p className="text-sm mt-1">
        Sincroniza el caso desde PJN para obtener los intervinientes
      </p>
    </div>
  )
}
