"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { PerfumeDetails } from "@/lib/perfumes";
import { updateManualPerfumeAction, type ManualPerfumeInput } from "@/lib/actions/perfumes";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ManualForm } from "@/components/add-perfume-dialog";

// Reouvre le formulaire de creation manuelle, pre-rempli avec les
// caracteristiques actuelles du parfum. Uniquement propose pour les parfums
// sans fragranticaUrl (donc crees a la main) - voir PerfumeDetailSheet.
export function EditPerfumeDialog({
  perfume,
  open,
  onOpenChange,
}: {
  perfume: PerfumeDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();

  function handleConfirm(input: ManualPerfumeInput) {
    startTransition(async () => {
      try {
        await updateManualPerfumeAction(perfume.id, input);
        toast.success("Parfum mis a jour");
        onOpenChange(false);
      } catch {
        toast.error("Impossible de mettre a jour ce parfum");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] w-[calc(100%-2rem)] max-w-md flex-col overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Modifier le parfum</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <ManualForm
            initial={{
              name: perfume.name,
              brand: perfume.brand,
              imagePublicId: perfume.imagePublicId,
              imagePreviewUrl: perfume.imageUrl,
              inspiredBy: perfume.inspiredBy,
              notes: perfume.notes,
              meta: {
                price: perfume.price,
                volumeMl: perfume.volumeMl,
                concentration: perfume.concentration as ManualPerfumeInput["concentration"],
                gender: perfume.gender,
                tags: perfume.tags as ManualPerfumeInput["tags"],
              },
            }}
            submitLabel="Enregistrer"
            pending={pending}
            onCancel={() => onOpenChange(false)}
            onConfirm={handleConfirm}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
