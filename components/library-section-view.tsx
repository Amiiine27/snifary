"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Grid2x2, List } from "lucide-react";
import type { PerfumeDetails } from "@/lib/perfumes";
import { PerfumeCard } from "@/components/perfume-card";
import { PerfumeDetailSheet } from "@/components/perfume-detail-sheet";
import { AddFab } from "@/components/add-fab";
import { FiltersSheet, EMPTY_FILTERS, type LibraryFilters } from "@/components/filters-sheet";
import { cn } from "@/lib/utils";

export type LibraryItem = { itemId: number; perfume: PerfumeDetails; personalNote: string | null };

type Target = { kind: "collection" } | { kind: "wishlist"; wishlistId: number };

export function LibrarySectionView({
  title,
  items,
  target,
  prevHref,
  nextHref,
}: {
  title: string;
  items: LibraryItem[];
  target: Target;
  prevHref: string | null;
  nextHref: string | null;
}) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<LibraryItem | null>(null);

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (filters.gender && i.perfume.gender !== filters.gender) return false;
        if (filters.tags.length > 0 && !filters.tags.some((t) => i.perfume.tags.includes(t))) return false;
        return true;
      }),
    [items, filters]
  );

  return (
    <div className="flex flex-col gap-5 px-4 pt-20">
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
      />

      <AddFab target={target} />
    </div>
  );
}
