"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Droplet, Plus, Loader2 } from "lucide-react";
import type { ReferencePerfume } from "@/lib/perfumes";
import { quickAddToCollectionAction } from "@/lib/actions/perfumes";

// Section "Decouvrir" de l'accueil : tirage aleatoire dans le dataset local
// (fragrantica_reference, ~24k parfums), filtre par la preference de genre
// du profil. Jamais d'image (le dataset n'en a pas) -- carte compacte plutot
// que le grid a vignettes utilise ailleurs, pour ne pas repeter une icone
// placeholder identique sur des dizaines de cartes. Tape dessus l'ajoute
// directement a la collection (quickAddToCollectionAction).
export function DiscoverSection({ perfumes }: { perfumes: ReferencePerfume[] }) {
  const [pending, startTransition] = useTransition();

  if (perfumes.length === 0) return null;

  function handleAdd(url: string) {
    startTransition(async () => {
      try {
        await quickAddToCollectionAction(url);
        toast.success("Ajoute a ta collection");
      } catch {
        toast.error("Impossible d'ajouter ce parfum");
      }
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-xl">Decouvrir</h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {perfumes.map((p) => (
          <button
            key={p.fragranticaUrl}
            onClick={() => handleAdd(p.fragranticaUrl)}
            disabled={pending}
            className="flex w-36 shrink-0 flex-col items-start gap-2 rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
          >
            <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Droplet className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-medium leading-tight">{p.name}</p>
              <p className="line-clamp-1 text-xs text-muted-foreground">{p.brand}</p>
            </div>
            <span className="flex items-center gap-1 text-xs text-primary">
              {pending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />} Ajouter
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
