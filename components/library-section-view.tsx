"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Grid2x2, List } from "lucide-react";
import type { PerfumeDetails } from "@/lib/perfumes";
import { PerfumeCard } from "@/components/perfume-card";
import { PerfumeDetailSheet } from "@/components/perfume-detail-sheet";
import { AddPerfumeSheet } from "@/components/add-perfume-sheet";
import { cn } from "@/lib/utils";

export type LibraryItem = { itemId: number; perfume: PerfumeDetails; personalNote: string | null };

type Target = { kind: "collection" } | { kind: "wishlist"; wishlistId: number };

const GENDER_FILTERS = ["homme", "femme", "unisexe"] as const;

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
  const [genderFilter, setGenderFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<LibraryItem | null>(null);

  const filtered = useMemo(
    () => (genderFilter ? items.filter((i) => i.perfume.gender === genderFilter) : items),
    [items, genderFilter]
  );

  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
      <div className="flex items-center justify-between">
        <Link
          href={prevHref ?? "#"}
          aria-disabled={!prevHref}
          className={cn("p-1", !prevHref && "pointer-events-none opacity-30")}
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold">{title}</h1>
        <Link
          href={nextHref ?? "#"}
          aria-disabled={!nextHref}
          className={cn("p-1", !nextHref && "pointer-events-none opacity-30")}
        >
          <ChevronRight className="size-5" />
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {GENDER_FILTERS.map((g) => (
            <button
              key={g}
              onClick={() => setGenderFilter((prev) => (prev === g ? null : g))}
              className={cn(
                "rounded-full border border-border px-2.5 py-1 text-xs capitalize transition-colors",
                genderFilter === g ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setView("grid")}
            className={cn("rounded-md p-1.5", view === "grid" ? "bg-muted" : "text-muted-foreground")}
          >
            <Grid2x2 className="size-4" />
          </button>
          <button
            onClick={() => setView("list")}
            className={cn("rounded-md p-1.5", view === "list" ? "bg-muted" : "text-muted-foreground")}
          >
            <List className="size-4" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Rien ici pour l&apos;instant. Ajoute un premier parfum avec le bouton +.
        </p>
      ) : (
        <div className={view === "grid" ? "grid grid-cols-3 gap-2.5" : "flex flex-col gap-2"}>
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

      <AddPerfumeSheet target={target} />
    </div>
  );
}
