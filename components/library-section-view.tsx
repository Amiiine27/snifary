"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Grid2x2, List, Trash2 } from "lucide-react";
import type { PerfumeDetails, ReferencePerfume } from "@/lib/perfumes";
import { PerfumeCard } from "@/components/perfume-card";
import { PerfumeDetailSheet } from "@/components/perfume-detail-sheet";
import { ReferencePerfumeSheet } from "@/components/reference-perfume-sheet";
import { AddFab } from "@/components/add-fab";
import { FiltersSheet, EMPTY_FILTERS, type LibraryFilters } from "@/components/filters-sheet";
import { Button } from "@/components/ui/button";
import { deleteWishlistAction } from "@/lib/actions/wishlists";
import { cn } from "@/lib/utils";

export type LibraryItem = { itemId: number; perfume: PerfumeDetails; personalNote: string | null };

type Target = { kind: "collection" } | { kind: "wishlist"; wishlistId: number };

// Chips fixes en haut de la vue, jamais optionnelles : la collection et
// chaque wishlist utilisent exactement le meme gabarit (voir PROJECT.md),
// seul le contenu (chiffres + libelles) change selon `target.kind`.
function StatChip({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-full bg-muted px-3.5 py-2">
      <span className="text-lg font-semibold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function LibrarySectionView({
  title,
  items,
  target,
  prevHref,
  nextHref,
  wishlists,
}: {
  title: string;
  items: LibraryItem[];
  target: Target;
  prevHref: string | null;
  nextHref: string | null;
  wishlists: { id: number; name: string }[];
}) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<LibraryItem | null>(null);
  // "Vous pourriez aimer" depuis une fiche possedee ouvre toujours un parfum
  // pas encore ajoute (voir getSimilarPerfumes) -- state separe plutot que de
  // reutiliser `selected`, qui suppose un LibraryItem (itemId, personalNote).
  const [selectedSimilar, setSelectedSimilar] = useState<ReferencePerfume | null>(null);

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (filters.gender && i.perfume.gender !== filters.gender) return false;
        if (filters.tags.length > 0 && !filters.tags.some((t) => i.perfume.tags.includes(t))) return false;
        return true;
      }),
    [items, filters]
  );

  const count = items.length;
  const totalPrice = items.reduce((sum, i) => sum + (i.perfume.price ?? 0), 0);
  const isCollection = target.kind === "collection";

  return (
    <div className="flex flex-col gap-5 px-4 pt-4">
      {/* Chips toujours affichees, meme gabarit collection/wishlist -- seul le
          contenu change (voir StatChip plus haut et PROJECT.md). */}
      <div className="flex flex-wrap justify-center gap-2">
        <StatChip
          value={count}
          label={isCollection ? `parfum${count > 1 ? "s" : ""} possede${count > 1 ? "s" : ""}` : `parfum${count > 1 ? "s" : ""}`}
        />
        <StatChip value={`${totalPrice.toFixed(0)} €`} label={isCollection ? "depenses" : "au total"} />
      </div>

      {/* Chevrons toujours affiches (pas seulement pour les wishlists) : depuis
          que l'icone "Wishlists" a quitte la bottom nav, cette fleche "next"
          -- deja calculee cote serveur mais jamais rendue avant -- est
          devenue le seul chemin vers les wishlists depuis la collection. */}
      <div className="flex items-center justify-between">
        <Link
          href={prevHref ?? "#"}
          aria-disabled={!prevHref}
          className={cn("p-1.5", !prevHref && "pointer-events-none opacity-30")}
        >
          <ChevronLeft className="size-6" />
        </Link>
        <h1 className="font-heading text-2xl">{title}</h1>
        <Link
          href={nextHref ?? "#"}
          aria-disabled={!nextHref}
          className={cn("p-1.5", !nextHref && "pointer-events-none opacity-30")}
        >
          <ChevronRight className="size-6" />
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <FiltersSheet filters={filters} onChange={setFilters} />
        <div className="flex gap-1.5">
          <button
            onClick={() => setView("grid")}
            className={cn("rounded-lg p-2.5", view === "grid" ? "bg-muted" : "text-muted-foreground")}
            aria-label="Vue grille"
          >
            <Grid2x2 className="size-5" />
          </button>
          <button
            onClick={() => setView("list")}
            className={cn("rounded-lg p-2.5", view === "list" ? "bg-muted" : "text-muted-foreground")}
            aria-label="Vue liste"
          >
            <List className="size-5" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {items.length === 0
            ? "Rien ici pour l'instant. Ajoute un premier parfum avec le bouton +."
            : "Aucun parfum ne correspond a ces filtres."}
        </p>
      ) : (
        <div className={view === "grid" ? "grid grid-cols-3 gap-3" : "flex flex-col gap-2.5"}>
          {filtered.map((item) => (
            <PerfumeCard
              key={item.itemId}
              perfume={item.perfume}
              view={view}
              onClick={() => setSelected(item)}
            />
          ))}
        </div>
      )}

      <PerfumeDetailSheet
        perfume={selected?.perfume ?? null}
        context={
          selected
            ? target.kind === "collection"
              ? { kind: "collection", itemId: selected.itemId, personalNote: selected.personalNote }
              : { kind: "wishlist", itemId: selected.itemId }
            : null
        }
        onOpenChange={(open) => !open && setSelected(null)}
        onSelectSimilar={(p) => {
          setSelected(null);
          setSelectedSimilar(p);
        }}
      />

      <ReferencePerfumeSheet
        perfume={selectedSimilar}
        wishlists={wishlists}
        onOpenChange={(open) => !open && setSelectedSimilar(null)}
        onSelectSimilar={setSelectedSimilar}
      />

      {target.kind === "wishlist" && <DeleteWishlistButton wishlistId={target.wishlistId} />}

      <AddFab target={target} />
    </div>
  );
}

// Au-dessus du FAB "+", uniquement sur une wishlist (jamais sur la
// collection, qui ne se supprime pas). Supprime la wishlist entiere (et son
// contenu, cascade DB) puis retourne a la collection, seul endroit stable
// une fois la wishlist courante disparue.
function DeleteWishlistButton({ wishlistId }: { wishlistId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Supprimer cette wishlist et tout son contenu ?")) return;
    startTransition(async () => {
      await deleteWishlistAction(wishlistId);
      router.push("/library/collection");
    });
  }

  return (
    <Button
      variant="destructive"
      size="icon"
      disabled={pending}
      onClick={handleDelete}
      aria-label="Supprimer la wishlist"
      className="fixed bottom-44 right-4 z-30 size-12 rounded-full shadow-lg"
    >
      <Trash2 />
    </Button>
  );
}
