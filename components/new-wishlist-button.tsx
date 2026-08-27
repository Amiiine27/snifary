"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createWishlistAction } from "@/lib/actions/wishlists";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewWishlistDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    if (!name.trim()) return;
    startTransition(async () => {
      await createWishlistAction(name);
      toast.success("Wishlist creee");
      setName("");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex min-h-[320px] flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Nouvelle wishlist</DialogTitle>
        </DialogHeader>
        <div className="flex flex-1 flex-col justify-center gap-3">
          <Input
            autoFocus
            placeholder="Ex: A acheter"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button onClick={handleCreate} disabled={pending || !name.trim()}>
            Creer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NewWishlistButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus /> Nouvelle wishlist
      </Button>
      <NewWishlistDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
