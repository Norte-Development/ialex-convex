import type React from "react"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"

interface SaveTemplateModalProps {
  open: boolean
  defaultValues: { title?: string; category?: string; isPublic?: boolean; tags?: string[] }
  onOpenChange: (open: boolean) => void
  onSave: (title: string, category: string, isPublic: boolean, tags: string[] ) => Promise<void>
}

export function SaveTemplateModal({ open, onOpenChange, onSave, defaultValues }: SaveTemplateModalProps) {
  const [title, setTitle] = useState(defaultValues.title || "")
  const [category, setCategory] = useState(defaultValues.category || "")
  const [isPublic, setIsPublic] = useState(defaultValues.isPublic || false)
  const [tags, setTags] = useState<string[]>(defaultValues.tags || [])
  const [tagInput, setTagInput] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim()
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag])
      setTagInput("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleSave = async () => {
    if (!title.trim() || !category.trim()) {
      return
    }

    setIsSaving(true)
    try {
      await onSave(title.trim(), category.trim(), isPublic, tags)
      setTitle("")
      setCategory("")
      setIsPublic(false)
      setTags([])
      setTagInput("")
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to save template:", error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Save as Template</DialogTitle>
          <DialogDescription className="text-base">
            Guarda este escrito como un modelo para reutilizarlo en el futuro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="title-input" className="text-base font-medium">
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title-input"
              placeholder="Ej: Contrato de Compraventa"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-input" className="text-base font-medium">
              Categoría <span className="text-destructive">*</span>
            </Label>
            <Input
              id="category-input"
              placeholder="Ej: Contratos"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="text-base"
            />
          </div>

          <div className="flex items-center justify-between space-x-4 rounded-lg border border-border bg-muted/50 p-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="public-toggle" className="text-base font-medium">
                Hacer Público
              </Label>
              <p className="text-sm text-muted-foreground">Permitir que otros descubran y utilicen este modelo</p>
            </div>
            <Switch id="public-toggle" checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="tag-input" className="text-base font-medium">
                Etiquetas
              </Label>
              <p className="text-sm text-muted-foreground">Add tags to help categorize and find this template</p>
            </div>

            <div className="flex gap-2">
              <Input
                id="tag-input"
                placeholder="Ej: Contrato, Compraventa"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button type="button" variant="secondary" onClick={handleAddTag} disabled={!tagInput.trim()}>
                Agregar
              </Button>
            </div>

            {tags?.length && tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-muted/30 p-3">
                {tags?.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 pl-3 pr-2 text-sm">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 rounded-full hover:bg-muted-foreground/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim() || !category.trim()}>
            {isSaving ? "Guardando..." : "Guardar Modelo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
