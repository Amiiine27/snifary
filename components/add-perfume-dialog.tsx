"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Search, Loader2, AlertCircle, Plus, Upload } from "lucide-react";
import type { PerfumeCard as PerfumeCardData } from "@/lib/perfumes";
import {
  searchLocalPerfumesAction,
  searchFragranticaCandidatesAction,
  resolvePerfumeAction,
  savePerfumeAction,
  createManualPerfumeAction,
  uploadPerfumeImageAction,
  type ManualPerfumeInput,
} from "@/lib/actions/perfumes";
import { addToCollectionAction } from "@/lib/actions/collection";
import { addItemToWishlistAction } from "@/lib/actions/wishlists";
import { removeImageBackground } from "@/lib/remove-background";
import { guessConcentration } from "@/lib/concentration";
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
type View = "search" | "manual";

const TAG_OPTIONS = [
  { value: "printemps", label: "Printemps" },
  { value: "ete", label: "Ete" },
  { value: "automne", label: "Automne" },
  { value: "hiver", label: "Hiver" },
  { value: "jour", label: "Jour" },
  { value: "nuit", label: "Nuit" },
] as const;

type MetaValues = {
  price: number | null;
  volumeMl: number;
  concentration: "edt" | "edp" | "parfum" | "extrait" | "cologne" | null;
  gender: "homme" | "femme" | "unisexe";
  tags: (typeof TAG_OPTIONS)[number]["value"][];
};

export function AddPerfumeDialog({
  target,
  open,
  onOpenChange,
}: {
  target: Target;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [view, setView] = useState<View>("search");
  const [query, setQuery] = useState("");

  const [localResults, setLocalResults] = useState<PerfumeCardData[] | null>(null);
  const [localSearching, setLocalSearching] = useState(false);

  const [remoteResults, setRemoteResults] = useState<FragranticaCandidate[] | null>(null);
  const [remoteSearching, setRemoteSearching] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  const [pending, startTransition] = useTransition();

  const queryTooShort = query.trim().length < 2;

  // Recherche locale : quasi instantanee, jamais bloquee par le reseau.
  useEffect(() => {
    if (!open || view !== "search" || queryTooShort) return;
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
  }, [query, open, view, queryTooShort]);

  // Recherche Fragrantica : plus lente et moins fiable (reseau externe), a
  // part pour ne jamais bloquer l'affichage des resultats locaux ci-dessus.
  useEffect(() => {
    if (!open || view !== "search" || queryTooShort) return;
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
  }, [query, open, view, queryTooShort]);

  function reset() {
    setView("search");
    setQuery("");
    setLocalResults(null);
    setRemoteResults(null);
    setRemoteError(null);
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

  // Aucune etape de confirmation manuelle : ni le dataset local ni Fragrantica
  // n'exposent prix/contenance/categories de facon fiable (voir PROJECT.md),
  // donc rien de reel a faire confirmer a l'utilisateur ici -- on ajoute
  // directement avec les infos deja connues (genre, notes, concentration
  // devinee depuis le nom quand possible).
  function handlePickCandidate(url: string) {
    startTransition(async () => {
      try {
        const result = await resolvePerfumeAction(url);
        const perfumeId =
          "existingId" in result
            ? result.existingId
            : await savePerfumeAction({
                draft: result.draft,
                price: null,
                volumeMl: 100,
                concentration: guessConcentration(result.draft.name),
                gender: result.draft.gender,
                tags: [],
              });
        await addPerfumeIdToTarget(perfumeId);
        toast.success("Ajoute");
        onOpenChange(false);
        reset();
      } catch {
        toast.error("Impossible d'ajouter ce parfum");
      }
    });
  }

  // Deliberement pas limite au cas "zero resultat" : une fois un premier
  // parfum ajoute (ex. "Paradigme" en manuel), retaper le meme nom pour
  // ajouter une AUTRE variante (ex. "Paradigme Le Parfum") le trouvait sous
  // "Deja dans Snifary" et cachait le bouton manuel du coup -- aucun moyen
  // d'ajouter la seconde variante sans repartir d'une recherche differente.
  const canAddManually = !queryTooShort && !localSearching && !remoteSearching;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="flex h-[80vh] w-[calc(100%-2rem)] max-w-md flex-col overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {view === "manual" && "Ajouter manuellement"}
            {view === "search" && "Ajouter un parfum"}
          </DialogTitle>
        </DialogHeader>

        {view === "search" && (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
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

            {!queryTooShort && (
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
            )}

            {canAddManually && (
              <Button variant="outline" onClick={() => setView("manual")}>
                <Plus /> Ajouter un parfum manuellement
              </Button>
            )}
          </div>
        )}

        {view === "manual" && (
          <div className="flex-1 overflow-y-auto">
            <ManualForm
              initial={{ name: query }}
              pending={pending}
              onCancel={() => setView("search")}
              onConfirm={(input) => {
                startTransition(async () => {
                  try {
                    const perfumeId = await createManualPerfumeAction(input);
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

// Champs communs (prix, contenance, concentration, genre, categories) partages
// entre la confirmation d'un brouillon scrape et la saisie 100% manuelle.
function MetaFields({ value, onChange }: { value: MetaValues; onChange: (v: MetaValues) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Prix (&euro;)</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={value.price ?? ""}
            onChange={(e) => onChange({ ...value, price: e.target.value ? Number(e.target.value) : null })}
            placeholder="90"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Contenance (mL)</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={value.volumeMl}
            onChange={(e) => onChange({ ...value, volumeMl: Number(e.target.value) || 100 })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Concentration</Label>
          <Select
            value={value.concentration ?? "none"}
            onValueChange={(v) => onChange({ ...value, concentration: v === "none" ? null : (v as MetaValues["concentration"]) })}
          >
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
          <Select value={value.gender} onValueChange={(v) => onChange({ ...value, gender: v as MetaValues["gender"] })}>
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
                checked={value.tags.includes(tag.value)}
                onCheckedChange={(checked) =>
                  onChange({
                    ...value,
                    tags: checked ? [...value.tags, tag.value] : value.tags.filter((t) => t !== tag.value),
                  })
                }
              />
              {tag.label}
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

function parseNotesList(value: string): string[] {
  return value
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

export type ManualFormInitial = {
  name?: string;
  brand?: string;
  imagePublicId?: string | null;
  imagePreviewUrl?: string | null;
  inspiredBy?: string | null;
  notes?: { top: string[]; heart: string[]; base: string[] };
  meta?: MetaValues;
};

export function ManualForm({
  initial,
  submitLabel = "Ajouter",
  pending,
  onCancel,
  onConfirm,
}: {
  initial?: ManualFormInitial;
  submitLabel?: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (input: ManualPerfumeInput) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [imagePreview, setImagePreview] = useState<string | null>(initial?.imagePreviewUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [topNotes, setTopNotes] = useState(initial?.notes?.top.join(", ") ?? "");
  const [heartNotes, setHeartNotes] = useState(initial?.notes?.heart.join(", ") ?? "");
  const [baseNotes, setBaseNotes] = useState(initial?.notes?.base.join(", ") ?? "");
  const [isClone, setIsClone] = useState(!!initial?.inspiredBy);
  const [inspiredBy, setInspiredBy] = useState(initial?.inspiredBy ?? "");
  const [meta, setMeta] = useState<MetaValues>(
    initial?.meta ?? {
      price: null,
      volumeMl: 100,
      concentration: null,
      gender: "unisexe",
      tags: [],
    }
  );

  // L'upload tourne en arriere-plan (voir handleFile) : le reste du formulaire
  // reste editable pendant ce temps. Seul le bouton "Ajouter" attend, et
  // uniquement si l'utilisateur clique avant que l'upload soit termine --
  // cette promesse est ce qu'il attend a ce moment-la (voir handleSubmit).
  const uploadPromiseRef = useRef<Promise<string | null>>(Promise.resolve(initial?.imagePublicId ?? null));
  const [waitingForImage, setWaitingForImage] = useState(false);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);

    uploadPromiseRef.current = (async () => {
      // La suppression de fond est un plus, pas une condition bloquante : si
      // elle echoue (reseau, CDN du modele injoignable, etc.) on continue avec
      // l'image d'origine plutot que d'empecher tout l'ajout du parfum.
      let toUpload: Blob = file;
      try {
        toUpload = await removeImageBackground(file);
      } catch (err) {
        console.error("Suppression de fond echouee, image originale conservee :", err);
        toast.info("Suppression du fond indisponible, image d'origine conservee");
      }

      try {
        const uploadFile = new File([toUpload], "perfume.png", { type: toUpload.type || file.type });
        const publicId = await uploadPerfumeImageAction(uploadFile);
        setImagePreview(URL.createObjectURL(toUpload));
        return publicId;
      } catch (err) {
        console.error("Upload de l'image echoue :", err);
        toast.error("Impossible d'uploader l'image");
        return null;
      } finally {
        setUploading(false);
      }
    })();
  }

  const canSubmit = name.trim().length > 0 && brand.trim().length > 0;

  async function handleSubmitClick() {
    setWaitingForImage(true);
    const finalImagePublicId = await uploadPromiseRef.current;
    setWaitingForImage(false);
    onConfirm({
      name,
      brand,
      imagePublicId: finalImagePublicId,
      inspiredBy: isClone ? inspiredBy : null,
      ...meta,
      notes: {
        top: parseNotesList(topNotes),
        heart: parseNotesList(heartNotes),
        base: parseNotesList(baseNotes),
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted text-muted-foreground"
        >
          {imagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview local avant upload, pas une image distante a optimiser
            <img src={imagePreview} alt="" className="size-full object-contain p-1" />
          ) : uploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Upload className="size-5" />
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className="flex-1 space-y-2">
          <Input placeholder="Nom du parfum" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Marque" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Notes olfactives (separees par des virgules)</Label>
        <Input placeholder="Notes de tete" value={topNotes} onChange={(e) => setTopNotes(e.target.value)} />
        <Input placeholder="Notes de coeur" value={heartNotes} onChange={(e) => setHeartNotes(e.target.value)} />
        <Input placeholder="Notes de fond" value={baseNotes} onChange={(e) => setBaseNotes(e.target.value)} />
      </div>

      <MetaFields value={meta} onChange={setMeta} />

      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-sm">
          <Checkbox checked={isClone} onCheckedChange={(checked) => setIsClone(checked === true)} />
          Clone
        </label>
        {isClone && (
          <Input
            placeholder="Inspire de quel parfum ?"
            value={inspiredBy}
            onChange={(e) => setInspiredBy(e.target.value)}
          />
        )}
      </div>

      <div className="mt-2 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={pending}>
          Retour
        </Button>
        <Button className="flex-1" disabled={pending || !canSubmit || waitingForImage} onClick={handleSubmitClick}>
          {pending || waitingForImage ? "..." : submitLabel}
        </Button>
      </div>
    </div>
  );
}
