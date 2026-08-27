"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Droplet } from "lucide-react";
import type { ReferencePerfume } from "@/lib/perfumes";
import { ReferencePerfumeSheet } from "@/components/reference-perfume-sheet";

// Section "Decouvrir" de l'accueil : tirage aleatoire dans le dataset local
// (fragrantica_reference, ~24k parfums), filtre par la preference de genre
// du profil. Jamais d'image (le dataset n'en a pas) -- carte compacte plutot
// que le grid a vignettes utilise ailleurs, pour ne pas repeter une icone
// placeholder identique sur des dizaines de cartes. Tape dessus -> ouvre la
// fiche complete (ReferencePerfumeSheet), qui laisse choisir collection
// et/ou wishlist(s) avant d'ecrire quoi que ce soit.
export function DiscoverSection({
  perfumes,
  wishlists,
}: {
  perfumes: ReferencePerfume[];
  wishlists: { id: number; name: string }[];
}) {
  const [selected, setSelected] = useState<ReferencePerfume | null>(null);

  if (perfumes.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <Link href="/discover" className="flex items-center justify-between">
        <h2 className="font-heading text-xl">Decouvrir</h2>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {perfumes.map((p) => (
          <button
            key={p.fragranticaUrl}
            onClick={() => setSelected(p)}
            className="flex w-36 shrink-0 flex-col items-start gap-2 rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted"
          >
            <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Droplet className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-medium leading-tight">{p.name}</p>
              <p className="line-clamp-1 text-xs text-muted-foreground">{p.brand}</p>
            </div>
          </button>
        ))}
      </div>

      <ReferencePerfumeSheet
        perfume={selected}
        wishlists={wishlists}
        onOpenChange={(open) => !open && setSelected(null)}
        onSelectSimilar={setSelected}
      />
    </section>
  );
}
