"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Search } from "lucide-react";
import type { ReferencePerfume } from "@/lib/perfumes";
import { ReferencePerfumeSheet } from "@/components/reference-perfume-sheet";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const GENDER_OPTIONS = [
  { value: null, label: "Tous" },
  { value: "homme", label: "Homme" },
  { value: "femme", label: "Femme" },
  { value: "unisexe", label: "Unisexe" },
] as const;

// Catalogue complet d'une marque, tire du dataset local (fragrantica_reference,
// voir lib/perfumes.ts getBrandCatalog) -- pas seulement ce qui est deja dans
// Snifary. Tri/filtre volontairement legers (recherche texte + genre) : ces
// lignes n'ont ni tags ni notes structurees comme un PerfumeDetails possede,
// donc LibrarySectionView (pense pour des items possedes) n'est pas reutilisable
// tel quel ici. Tape sur une ligne -> ouvre la fiche complete
// (ReferencePerfumeSheet), qui laisse choisir collection et/ou wishlist(s).
export function BrandCatalogView({
  brand,
  perfumes,
  wishlists,
}: {
  brand: string;
  perfumes: ReferencePerfume[];
  wishlists: { id: number; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<(typeof GENDER_OPTIONS)[number]["value"]>(null);
  const [selected, setSelected] = useState<ReferencePerfume | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return perfumes.filter((p) => {
      if (gender && p.gender !== gender) return false;
      if (term && !p.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [perfumes, query, gender]);

  return (
    <div className="flex flex-col gap-5 px-4 pt-4">
      <div className="flex items-center gap-2">
        <Link href="/" className="p-1.5" aria-label="Retour">
          <ChevronLeft className="size-6" />
        </Link>
        <h1 className="flex-1 text-center font-heading text-2xl">{brand}</h1>
        <span className="w-9" aria-hidden />
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={`Chercher dans ${brand}...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {GENDER_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => setGender(opt.value)}
            className={cn(
              "rounded-full border border-border px-3 py-1.5 text-xs font-medium",
              gender === opt.value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {perfumes.length === 0 ? "Aucun parfum trouve pour cette marque." : "Aucun resultat pour ce filtre."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((p) => (
            <button
              key={p.fragranticaUrl}
              onClick={() => setSelected(p)}
              className="rounded-lg border border-border p-3 text-left text-sm font-medium transition-colors hover:bg-muted"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <ReferencePerfumeSheet
        perfume={selected}
        wishlists={wishlists}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}
