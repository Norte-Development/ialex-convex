import { Pen, Trash } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function HeaderOfDocument() {
  return (
    <div className="flex w-full h-12 gap-4 justify-end items-center bg-transparent pr-4">
      <Dialog>
        <DialogTrigger asChild>
          <Pen size={20} className="cursor-pointer" />
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-center">
              Para editar el documento debes <br />
              <span className="font-bold">realizar una copia</span>
            </DialogTitle>
            <DialogDescription className="text-center text-lg pt-4">
              ¿Querés abrir copia en <strong>Escritos</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            <DialogClose asChild>
              <Button
                type="button"
                variant="destructive"
                className="bg-red-400 hover:bg-red-500"
              >
                Ahora no
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button type="button" className="bg-green-400 hover:bg-green-500">
                Sí
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Trash size={20} className="cursor-pointer" />
    </div>
  );
}
