"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Droplet, ShoppingBag, Trash2, Pencil, Sun, Snowflake, Flower2, Leaf, SunMedium, MoonStar } from "lucide-react";
import type { PerfumeDetails } from "@/lib/perfumes";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EditPerfumeDialog } from "@/components/edit-perfume-dialog";
import {
  removeFromCollectionAction,
  updatePersonalNoteAction,
} from "@/lib/actions/collection";
import {
  moveWishlistItemToCollectionAction,
  removeItemFromWishlistAction,
} from "@/lib/actions/wishlists";

const TAG_ICON: Record<string, React.ElementType> = {
  printemps: Flower2,
  ete: Sun,
  automne: Leaf,
  hiver: Snowflake,
  jour: SunMedium,
  nuit: MoonStar,
};

const TAG_LABEL: Record<string, string> = {
  printemps: "Printemps",
  ete: "Ete",
  automne: "Automne",
  hiver: "Hiver",
  jour: "Jour",
  nuit: "Nuit",
};

type Context =
  | { kind: "collection"; itemId: number; personalNote: string | null }
  | { kind: "wishlist"; itemId: number };

export function PerfumeDetailSheet({
  perfume,
  context,
  onOpenChange,
}: {
  perfume: PerfumeDetails | null;
  context: Context | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={perfume !== null} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="top-16 flex flex-col overflow-hidden rounded-t-2xl">
        {perfume && context && <DetailBody perfume={perfume} context={context} onClose={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function DetailBody({
  perfume,
  context,
  onClose,
}: {
  perfume: PerfumeDetails;
  context: Context;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(context.kind === "collection" ? context.personalNote ?? "" : "");
  const [editOpen, setEditOpen] = useState(false);
  const isManual = perfume.fragranticaUrl === null;

  function handleRemove() {
    startTransition(async () => {
      if (context.kind === "collection") {
        await removeFromCollectionAction(context.itemId);
      } else {
        await removeItemFromWishlistAction(context.itemId);
      }
      toast.success("Retire");
      onClose();
    });
  }

  function handleBought() {
    if (context.kind !== "wishlist") return;
    startTransition(async () => {
      await moveWishlistItemToCollectionAction(context.itemId, perfume.id);
      toast.success("Ajoute a ta collection");
      onClose();
    });
  }

  function handleSaveNote() {
    if (context.kind !== "collection") return;
    startTransition(async () => {
      await updatePersonalNoteAction(context.itemId, note);
      toast.success("Note enregistree");
    });
  }

  const noteChanged = context.kind === "collection" && note !== (context.personalNote ?? "");

  return (
    <>
      <SheetHeader className="items-center text-center">
        <div className="relative mb-2 h-40 w-32 shrink-0 overflow-hidden rounded-lg bg-muted">
          {perfume.imageUrl ? (
            // object-contain : l'image du parfum doit toujours etre visible en entier, jamais recadree.
            <Image src={perfume.imageUrl} alt={perfume.name} fill sizes="200px" className="object-contain" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <Droplet className="size-10" />
            </div>
          )}
        </div>
        <SheetTitle className="text-xl">{perfume.name}</SheetTitle>
        <p className="text-base text-muted-foreground">{perfume.brand}</p>
      </SheetHeader>

      <div className="flex-1 space-y-4 overflow-y-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
          {perfume.price != null && <span>{perfume.price}&nbsp;&euro;</span>}
          <span>{perfume.volumeMl}&nbsp;mL</span>
          {perfume.concentration && <span className="uppercase">{perfume.concentration}</span>}
          <span className="capitalize">{perfume.gender}</span>
        </div>

        {perfume.inspiredBy && (
          <p className="text-center text-xs text-muted-foreground">Clone inspire de {perfume.inspiredBy}</p>
        )}

        {perfume.tags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3">
            {perfume.tags.map((tag) => {
              const Icon = TAG_ICON[tag];
              return (
                <span key={tag} className="flex items-center gap-1 text-xs text-muted-foreground">
                  {Icon && <Icon className="size-3.5" />}
                  {TAG_LABEL[tag] ?? tag}
                </span>
              );
            })}
          </div>
        )}

        <div className="space-y-4">
          <NotesRow label="Tete" notes={perfume.notes.top} />
          <NotesRow label="Coeur" notes={perfume.notes.heart} />
          <NotesRow label="Fond" notes={perfume.notes.base} />
        </div>

        {context.kind === "collection" && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Note personnelle</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ton avis sur ce parfum..."
              rows={3}
            />
            {noteChanged && (
              <Button size="sm" onClick={handleSaveNote} disabled={pending}>
                Enregistrer
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-border px-4 py-4">
        {context.kind === "wishlist" && (
          <Button className="flex-1" onClick={handleBought} disabled={pending}>
            <ShoppingBag /> Je l&apos;ai achete
          </Button>
        )}
        {isManual && (
          <Button variant="outline" className={context.kind === "wishlist" ? "" : "flex-1"} onClick={() => setEditOpen(true)} disabled={pending}>
            <Pencil /> {context.kind === "wishlist" ? null : "Modifier"}
          </Button>
        )}
        <Button variant="outline" onClick={handleRemove} disabled={pending}>
          <Trash2 />
        </Button>
      </div>

      {isManual && <EditPerfumeDialog perfume={perfume} open={editOpen} onOpenChange={setEditOpen} />}
    </>
  );
}

function NotesRow({ label, notes }: { label: string; notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {notes.map((n) => (
          <span key={n} className="rounded-full bg-muted px-3 py-1.5 text-sm">
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}
