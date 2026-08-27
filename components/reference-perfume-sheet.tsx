"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ReferencePerfume } from "@/lib/perfumes";
import { saveReferencePerfumeAction } from "@/lib/actions/perfumes";
import { refineNewPerfumeImage } from "@/lib/refine-image";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { NotesRow } from "@/components/perfume-detail-sheet";
import { SimilarPerfumesSection } from "@/components/similar-perfumes-section";
import { ReferencePerfumeThumb } from "@/components/reference-perfume-thumb";

// Fiche d'un parfum pas encore dans `perfumes` (issu de Decouvrir ou d'une
// page marque, donc de fragrantica_reference). Contrairement a l'ancien
// comportement "tap = ajout direct a la collection", l'utilisateur voit
// d'abord la fiche complete et choisit lui-meme collection et/ou une ou
// plusieurs wishlists -- demande explicite, ces deux ecrans n'avaient pas de
// notion de "target" comme AddPerfumeDialog.
export function ReferencePerfumeSheet({
  perfume,
  wishlists,
  onOpenChange,
  onSelectSimilar,
}: {
  perfume: ReferencePerfume | null;
  wishlists: { id: number; name: string }[];
  onOpenChange: (open: boolean) => void;
  // Permet a "Vous pourriez aimer" de remplacer le parfum affiche sans
  // fermer la sheet -- par defaut, retombe sur onOpenChange(true) + le
  // parent devra gerer via son propre setSelected (voir DiscoverSection
  // etc., qui passent directement leur setter).
  onSelectSimilar?: (perfume: ReferencePerfume) => void;
}) {
  return (
    <Sheet open={perfume !== null} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="top-16 flex flex-col overflow-hidden rounded-t-2xl">
        {perfume && (
          <Body
            key={perfume.fragranticaUrl}
            perfume={perfume}
            wishlists={wishlists}
            onSaved={() => onOpenChange(false)}
            onSelectSimilar={onSelectSimilar}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Body({
  perfume,
  wishlists,
  onSaved,
  onSelectSimilar,
}: {
  perfume: ReferencePerfume;
  wishlists: { id: number; name: string }[];
  onSaved: () => void;
  onSelectSimilar?: (perfume: ReferencePerfume) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [price, setPrice] = useState("");
  const [toCollection, setToCollection] = useState(true);
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);

  const canSave = toCollection || wishlistIds.length > 0;

  function toggleWishlist(id: number, checked: boolean) {
    setWishlistIds((prev) => (checked ? [...prev, id] : prev.filter((w) => w !== id)));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const saved = await saveReferencePerfumeAction({
          fragranticaUrl: perfume.fragranticaUrl,
          price: price.trim() ? Number(price) : null,
          toCollection,
          wishlistIds,
        });
        // Fire-and-forget : ne bloque jamais l'enregistrement, l'image "pop"
        // en fond transparent quelques secondes plus tard (lib/refine-image.ts).
        if (saved.isNew && saved.imageUrl) void refineNewPerfumeImage(saved.perfumeId, saved.imageUrl);
        toast.success("Enregistre");
        onSaved();
      } catch {
        toast.error("Impossible d'enregistrer ce parfum");
      }
    });
  }

  return (
    <>
      <SheetHeader className="items-center text-center">
        <ReferencePerfumeThumb
          imageUrl={perfume.imageUrl}
          name={perfume.name}
          className="mb-2 h-40 w-32 shrink-0 rounded-lg"
          iconClassName="size-10"
          sizes="200px"
        />
        <SheetTitle className="text-xl">{perfume.name}</SheetTitle>
        <p className="text-base text-muted-foreground">{perfume.brand}</p>
      </SheetHeader>

      <div className="flex-1 space-y-4 overflow-y-auto px-4">
        <p className="text-center text-sm capitalize text-muted-foreground">{perfume.gender}</p>

        <div className="space-y-4">
          <NotesRow label="Tete" notes={perfume.notes.top} />
          <NotesRow label="Coeur" notes={perfume.notes.heart} />
          <NotesRow label="Fond" notes={perfume.notes.base} />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Prix (&euro;) &mdash; optionnel</label>
          <Input
            type="number"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Non renseigne"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Ajouter a</p>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={toCollection} onCheckedChange={(c) => setToCollection(c === true)} />
            Ma collection
          </label>
          {wishlists.map((w) => (
            <label key={w.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={wishlistIds.includes(w.id)}
                onCheckedChange={(c) => toggleWishlist(w.id, c === true)}
              />
              {w.name}
            </label>
          ))}
        </div>

        {onSelectSimilar && (
          <SimilarPerfumesSection
            source={{
              name: perfume.name,
              brand: perfume.brand,
              gender: perfume.gender,
              notes: perfume.notes,
              excludeFragranticaUrl: perfume.fragranticaUrl,
            }}
            onSelect={onSelectSimilar}
          />
        )}
      </div>

      <div className="shrink-0 border-t border-border px-4 py-4">
        <Button className="w-full" size="lg" onClick={handleSave} disabled={pending || !canSave}>
          {pending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </>
  );
}
