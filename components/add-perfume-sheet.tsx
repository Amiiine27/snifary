"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Search, Loader2 } from "lucide-react";
import type { ScrapedPerfume } from "@/lib/fragrantica";
import type { SearchResult } from "@/lib/actions/perfumes";
import { searchPerfumeAction, resolvePerfumeAction, savePerfumeAction } from "@/lib/actions/perfumes";
import { addToCollectionAction } from "@/lib/actions/collection";
import { addItemToWishlistAction } from "@/lib/actions/wishlists";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

const TAG_OPTIONS = [
  { value: "printemps", label: "Printemps" },
  { value: "ete", label: "Ete" },
  { value: "automne", label: "Automne" },
  { value: "hiver", label: "Hiver" },
  { value: "jour", label: "Jour" },
  { value: "nuit", label: "Nuit" },
] as const;

export function AddPerfumeSheet({ target }: { target: Target }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState<ScrapedPerfume | null>(null);
  const [pending, startTransition] = useTransition();

  const queryTooShort = query.trim().length < 2;

  useEffect(() => {
    if (!open || queryTooShort) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- etat de chargement du debounce, pattern recherche standard
    setSearching(true);
    const timeout = setTimeout(async () => {
      const res = await searchPerfumeAction(query);
      setResults(res);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timeout);
  }, [query, open, queryTooShort]);

  const displayResults = queryTooShort ? null : results;

  function reset() {
    setQuery("");
    setResults(null);
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
      await addPerfumeIdToTarget(perfumeId);
      toast.success("Ajoute");
      setOpen(false);
      reset();
    });
  }

  function handlePickCandidate(url: string) {
    startTransition(async () => {
      const result = await resolvePerfumeAction(url);
      if ("existingId" in result) {
        await addPerfumeIdToTarget(result.existingId);
        toast.success("Ajoute");
        setOpen(false);
        reset();
      } else {
        setDraft(result.draft);
      }
    });
  }

  return (
    <>
      <Button
        className="fixed bottom-24 right-4 z-30 size-16 rounded-full shadow-lg [&_svg:not([class*='size-'])]:size-7"
        onClick={() => setOpen(true)}
        aria-label="Ajouter un parfum"
      >
        <Plus />
      </Button>

      <Sheet
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{draft ? "Confirme les infos" : "Ajouter un parfum"}</SheetTitle>
          </SheetHeader>

          {!draft ? (
            <div className="flex flex-col gap-4 px-4 pb-4">
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

              {searching && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Recherche...
                </p>
              )}

              {displayResults && displayResults.inLibrary.length > 0 && (
                <ResultGroup title="Deja dans Snifary">
                  {displayResults.inLibrary.map((p) => (
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

              {displayResults && displayResults.onFragrantica.length > 0 && (
                <ResultGroup title="Sur Fragrantica">
                  {displayResults.onFragrantica.map((c) => (
                    <ResultRow
                      key={c.url}
                      title={c.title}
                      disabled={pending}
                      onClick={() => handlePickCandidate(c.url)}
                    />
                  ))}
                </ResultGroup>
              )}

              {displayResults &&
                displayResults.inLibrary.length === 0 &&
                displayResults.onFragrantica.length === 0 &&
                !searching && <p className="text-sm text-muted-foreground">Aucun resultat</p>}
            </div>
          ) : (
            <ConfirmForm
              draft={draft}
              pending={pending}
              onCancel={() => setDraft(null)}
              onConfirm={(values) => {
                startTransition(async () => {
                  const perfumeId = await savePerfumeAction({ draft, ...values });
                  await addPerfumeIdToTarget(perfumeId);
                  toast.success("Parfum ajoute");
                  setOpen(false);
                  reset();
                });
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
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
    <div className="flex flex-col gap-4 px-4 pb-4">
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
