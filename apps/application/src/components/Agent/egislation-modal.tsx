import {
    Dialog,
    DialogContent,
  } from "@/components/ui/dialog"
import { NormativeDetails } from "@/components/DataBase/NormativeDetails";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";


export function LegislationModal({ open, setOpen, normativeId }: { open: boolean, setOpen: (open: boolean) => void, normativeId: string }) {

  const getNormativeAction = useAction(api.functions.legislation.getNormativeById);


    return (
    <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <NormativeDetails jurisdiction="py" id={normativeId} getNormativeAction={getNormativeAction} />
      </DialogContent>
    </Dialog>   
    )
}