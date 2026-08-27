"use client";

import { useEffect, useMemo, useState } from "react";
import { Droplet, Search, Shuffle, Loader2 } from "lucide-react";
import type { ReferencePerfume } from "@/lib/perfumes";
import { searchDiscoverPerfumesAction, refreshDiscoverPerfumesAction } from "@/lib/actions/perfumes";
import { ReferencePerfumeSheet } from "@/components/reference-perfume-sheet";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const GENDER_OPTIONS = [
  { value: null, label: "Tous" },
  { value: "homme", label: "Homme" },
  { value: "femme", label: "Femme" },
  { value: "unisexe", label: "Unisexe" },
] as const;

// Version "poussee" de la section Decouvrir de l'accueil, sur sa propre page
// (remplace l'ancien acces direct aux wishlists dans la bottom nav -- les
// wishlists restent accessibles depuis Collection via le carrousel prev/next
// deja existant, voir PROJECT.md). Recherche libre dans les ~24k parfums du
// dataset local, filtre genre en plus du tirage aleatoire de depart, et un
// bouton pour tirer une nouvelle selection sans quitter la page.
export function DiscoverPageView({
  initialPerfumes,
  wishlists,
}: {
  initialPerfumes: ReferencePerfume[];
  wishlists: { id: number; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<(typeof GENDER_OPTIONS)[number]["value"]>(null);
  const [browsePerfumes, setBrowsePerfumes] = useState(initialPerfumes);
  const [searchResults, setSearchResults] = useState<ReferencePerfume[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ReferencePerfume | null>(null);

  const queryTooShort = query.trim().length < 2;

  useEffect(() => {
    if (queryTooShort) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- etat de chargement du debounce, pattern recherche standard
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await searchDiscoverPerfumesAction(query);
        if (!cancelled) setSearchResults(res);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, queryTooShort]);

  const list = queryTooShort ? browsePerfumes : (searchResults ?? browsePerfumes);
  const isSearchMode = !queryTooShort;
  const filtered = useMemo(() => (gender ? list.filter((p) => p.gender === gender) : list), [list, gender]);

  function handleShuffle() {
    setRefreshing(true);
    refreshDiscoverPerfumesAction()
      .then(setBrowsePerfumes)
      .finally(() => setRefreshing(false));
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-4">
      <h1 className="text-center font-heading text-2xl">Decouvrir</h1>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Chercher un parfum, une marque..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
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
        {!isSearchMode && (
          <button
            onClick={handleShuffle}
            disabled={refreshing}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : <Shuffle className="size-3.5" />}
            Autre selection
          </button>
        )}
      </div>

      {searching ? (
        <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Recherche...
        </p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {isSearchMode ? "Aucun resultat." : "Aucune suggestion pour ce filtre."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <button
              key={p.fragranticaUrl}
              onClick={() => setSelected(p)}
              className="flex flex-col items-start gap-2 rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted"
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
      )}

      <ReferencePerfumeSheet
        perfume={selected}
        wishlists={wishlists}
        onOpenChange={(open) => !open && setSelected(null)}
        onSelectSimilar={setSelected}
      />
    </div>
  );
}
