"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ReferencePerfume, SimilarPerfumeSource } from "@/lib/perfumes";
import { getSimilarPerfumesAction } from "@/lib/actions/perfumes";
import { ReferencePerfumeThumb } from "@/components/reference-perfume-thumb";

// "Vous pourriez aimer", partagee entre PerfumeDetailSheet (parfum deja
// possede) et ReferencePerfumeSheet (parfum pas encore ajoute) -- les deux
// fournissent la meme forme de `source`. Scoring reel (marque, gamme, notes
// en commun, voir getSimilarPerfumes dans lib/perfumes.ts), jamais de liste
// bidon : si rien ne se degage vraiment, la section ne s'affiche pas.
export function SimilarPerfumesSection({
  source,
  onSelect,
}: {
  source: SimilarPerfumeSource;
  onSelect: (perfume: ReferencePerfume) => void;
}) {
  const [items, setItems] = useState<ReferencePerfume[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- etat de chargement, meme pattern que les recherches
    setItems(null);
    getSimilarPerfumesAction(source)
      .then((res) => {
        if (!cancelled) setItems(res);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch uniquement quand le parfum affiche change vraiment
  }, [source.excludeFragranticaUrl, source.name, source.brand]);

  if (items !== null && items.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Vous pourriez aimer
      </p>
      {items === null ? (
        <p className="flex justify-center py-4">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto overscroll-x-contain pb-1 [touch-action:pan-x]">
          {items.map((p) => (
            <button
              key={p.fragranticaUrl}
              onClick={() => onSelect(p)}
              className="flex w-32 shrink-0 flex-col items-start gap-2 rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted"
            >
              <ReferencePerfumeThumb imageUrl={p.imageUrl} name={p.name} className="aspect-square w-full" iconClassName="size-5" />
              <div className="min-w-0">
                <p className="line-clamp-2 text-xs font-medium leading-tight">{p.name}</p>
                <p className="line-clamp-1 text-[11px] text-muted-foreground">{p.brand}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
