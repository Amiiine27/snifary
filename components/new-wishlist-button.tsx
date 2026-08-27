"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createWishlistAction } from "@/lib/actions/wishlists";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Nouvelle wishlist</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-4">
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
      </SheetContent>
    </Sheet>
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
