"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Search, Loader2, AlertCircle } from "lucide-react";
import type { ScrapedPerfume } from "@/lib/fragrantica";
import type { PerfumeCard as PerfumeCardData } from "@/lib/perfumes";
import {
  searchLocalPerfumesAction,
  searchFragranticaCandidatesAction,
  resolvePerfumeAction,
  savePerfumeAction,
} from "@/lib/actions/perfumes";
import { addToCollectionAction } from "@/lib/actions/collection";
import { addItemToWishlistAction } from "@/lib/actions/wishlists";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Target = { kind: "collection" } | { kind: "wishlist"; wishlistId: number };
type FragranticaCandidate = { url: string; title: string };

const TAG_OPTIONS = [
  { value: "printemps", label: "Printemps" },
  { value: "ete", label: "Ete" },
  { value: "automne", label: "Automne" },
  { value: "hiver", label: "Hiver" },
  { value: "jour", label: "Jour" },
  { value: "nuit", label: "Nuit" },
] as const;

export function AddPerfumeDialog({
  target,
  open,
  onOpenChange,
}: {
  target: Target;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");

  const [localResults, setLocalResults] = useState<PerfumeCardData[] | null>(null);
  const [localSearching, setLocalSearching] = useState(false);

  const [remoteResults, setRemoteResults] = useState<FragranticaCandidate[] | null>(null);
  const [remoteSearching, setRemoteSearching] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  const [draft, setDraft] = useState<ScrapedPerfume | null>(null);
  const [pending, startTransition] = useTransition();

  const queryTooShort = query.trim().length < 2;

  // Recherche locale : quasi instantanee, jamais bloquee par le reseau.
  useEffect(() => {
    if (!open || queryTooShort) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- etat de chargement du debounce, pattern recherche standard
    setLocalSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await searchLocalPerfumesAction(query);
        if (!cancelled) setLocalResults(res);
      } catch {
        if (!cancelled) setLocalResults([]);
      } finally {
        if (!cancelled) setLocalSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, open, queryTooShort]);

  // Recherche Fragrantica : plus lente et moins fiable (reseau externe), a
  // part pour ne jamais bloquer l'affichage des resultats locaux ci-dessus.
  useEffect(() => {
    if (!open || queryTooShort) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- etat de chargement du debounce, pattern recherche standard
    setRemoteSearching(true);
    setRemoteError(null);
    const timeout = setTimeout(async () => {
      try {
        const res = await searchFragranticaCandidatesAction(query);
        if (!cancelled) setRemoteResults(res);
      } catch {
        if (!cancelled) {
          setRemoteResults(null);
          setRemoteError("Recherche Fragrantica indisponible pour le moment.");
        }
      } finally {
        if (!cancelled) setRemoteSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, open, queryTooShort]);

  function reset() {
    setQuery("");
    setLocalResults(null);
    setRemoteResults(null);
    setRemoteError(null);
    setDraft(null);
  }

  async function addPerfumeIdToTarget(perfumeId: number) {
    if (target.kind === "collection") {
      await addToCollectionAction(perfumeId);
    } else {
      await addItemToWishlistAction(target.wishlistId, perfumeId);
    }
  }

  function handlePickExisting(perfumeId: number) {
    startTransition(async () => {
      try {
        await addPerfumeIdToTarget(perfumeId);
        toast.success("Ajoute");
        onOpenChange(false);
        reset();
      } catch {
        toast.error("Impossible d'ajouter ce parfum");
      }
    });
  }

  function handlePickCandidate(url: string) {
    startTransition(async () => {
      try {
        const result = await resolvePerfumeAction(url);
        if ("existingId" in result) {
          await addPerfumeIdToTarget(result.existingId);
          toast.success("Ajoute");
          onOpenChange(false);
          reset();
        } else {
          setDraft(result.draft);
        }
      } catch {
        toast.error("Impossible de recuperer cette fiche Fragrantica");
      }
    });
  }

  const noResultsAtAll =
    !queryTooShort &&
    !localSearching &&
    !remoteSearching &&
    (localResults?.length ?? 0) === 0 &&
    (remoteResults?.length ?? 0) === 0 &&
    !remoteError;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="flex max-h-[85vh] w-[calc(100%-2rem)] max-w-md flex-col overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{draft ? "Confirme les infos" : "Ajouter un parfum"}</DialogTitle>
        </DialogHeader>

        {!draft ? (
            <div className="flex flex-col gap-4 overflow-y-auto">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  className="pl-8"
                  placeholder="Nom du parfum..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {localResults && localResults.length > 0 && (
                <ResultGroup title="Deja dans Snifary">
                  {localResults.map((p) => (
                    <ResultRow
                      key={p.id}
                      title={p.name}
                      subtitle={p.brand}
                      disabled={pending}
                      onClick={() => handlePickExisting(p.id)}
                    />
                  ))}
                </ResultGroup>
              )}

              <ResultGroup title="Sur Fragrantica">
                {remoteSearching && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Recherche...
                  </p>
                )}
                {remoteError && (
                  <p className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="size-4" /> {remoteError}
                  </p>
                )}
                {remoteResults?.map((c) => (
                  <ResultRow
                    key={c.url}
                    title={c.title}
                    disabled={pending}
                    onClick={() => handlePickCandidate(c.url)}
                  />
                ))}
                {remoteResults?.length === 0 && !remoteSearching && !remoteError && (
                  <p className="text-sm text-muted-foreground">Aucun resultat</p>
                )}
              </ResultGroup>

              {noResultsAtAll && <p className="text-sm text-muted-foreground">Aucun resultat</p>}
            </div>
          ) : (
            <div className="overflow-y-auto">
              <ConfirmForm
                draft={draft}
                pending={pending}
                onCancel={() => setDraft(null)}
                onConfirm={(values) => {
                  startTransition(async () => {
                    try {
                      const perfumeId = await savePerfumeAction({ draft, ...values });
                      await addPerfumeIdToTarget(perfumeId);
                      toast.success("Parfum ajoute");
                      onOpenChange(false);
                      reset();
                    } catch {
                      toast.error("Impossible d'enregistrer ce parfum");
                    }
                  });
                }}
              />
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function ResultRow({
  title,
  subtitle,
  onClick,
  disabled,
}: {
  title: string;
  subtitle?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-border p-2.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
    >
      <p className="font-medium">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </button>
  );
}

type ConfirmValues = {
  price: number | null;
  volumeMl: number;
  concentration: "edt" | "edp" | "parfum" | "extrait" | "cologne" | null;
  gender: "homme" | "femme" | "unisexe";
  tags: (typeof TAG_OPTIONS)[number]["value"][];
};

function ConfirmForm({
  draft,
  pending,
  onCancel,
  onConfirm,
}: {
  draft: ScrapedPerfume;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (values: ConfirmValues) => void;
}) {
  const [price, setPrice] = useState("");
  const [volumeMl, setVolumeMl] = useState("100");
  const [concentration, setConcentration] = useState<string>("none");
  const [gender, setGender] = useState<ConfirmValues["gender"]>(draft.gender);
  const [tags, setTags] = useState<ConfirmValues["tags"]>([]);

  const totalNotes = useMemo(
    () => draft.notes.top.length + draft.notes.heart.length + draft.notes.base.length,
    [draft]
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-medium">{draft.name}</p>
        <p className="text-sm text-muted-foreground">{draft.brand}</p>
        {totalNotes > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{totalNotes} notes olfactives trouvees</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Prix (&euro;)</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="90"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Contenance (mL)</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={volumeMl}
            onChange={(e) => setVolumeMl(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Concentration</Label>
          <Select value={concentration} onValueChange={(v) => setConcentration(v ?? "none")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Non renseigne" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Non renseigne</SelectItem>
              <SelectItem value="edt">EDT</SelectItem>
              <SelectItem value="edp">EDP</SelectItem>
              <SelectItem value="parfum">Parfum</SelectItem>
              <SelectItem value="extrait">Extrait</SelectItem>
              <SelectItem value="cologne">Cologne</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Genre</Label>
          <Select value={gender} onValueChange={(v) => setGender(v as ConfirmValues["gender"])}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="homme">Homme</SelectItem>
              <SelectItem value="femme">Femme</SelectItem>
              <SelectItem value="unisexe">Unisexe</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Categories</Label>
        <div className="grid grid-cols-3 gap-2">
          {TAG_OPTIONS.map((tag) => (
            <label key={tag.value} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={tags.includes(tag.value)}
                onCheckedChange={(checked) =>
                  setTags((prev) =>
                    checked ? [...prev, tag.value] : prev.filter((t) => t !== tag.value)
                  )
                }
              />
              {tag.label}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={pending}>
          Retour
        </Button>
        <Button
          className="flex-1"
          disabled={pending}
          onClick={() =>
            onConfirm({
              price: price ? Number(price) : null,
              volumeMl: Number(volumeMl) || 100,
              concentration: concentration === "none" ? null : (concentration as ConfirmValues["concentration"]),
              gender,
              tags,
            })
          }
        >
          {pending ? "Ajout..." : "Ajouter"}
        </Button>
      </div>
    </div>
  );
}
