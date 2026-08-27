"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { perfumes, notes, perfumeNotes, perfumeTags, collectionItems } from "@/db/schema";
import { guessConcentration } from "@/lib/concentration";
import { splitNotesList } from "@/lib/notes";
import { requireUser } from "@/lib/session";
import {
  searchFragrantica,
  scrapeFragranticaPerfume,
  type ScrapedPerfume,
  type FragranticaCandidate,
} from "@/lib/fragrantica";
import { uploadImageFromUrl, uploadImageFromBuffer } from "@/lib/cloudinary";
import { findWikipediaPerfumeInfo } from "@/lib/wikipedia";
import {
  findPerfumesByName,
  findPerfumeByFragranticaUrl,
  searchFragranticaReference,
  searchReferencePerfumes,
  findReferenceByUrl,
  getDiscoverPerfumes,
  getUserGenderPreference,
} from "@/lib/perfumes";
import { addItemToWishlistAction } from "@/lib/actions/wishlists";

type Gender = "homme" | "femme" | "unisexe";
type Concentration = "edt" | "edp" | "parfum" | "extrait" | "cologne" | null;
type Tag = "printemps" | "ete" | "automne" | "hiver" | "jour" | "nuit";

// Etape 1a : recherche locale (cache Turso), quasi instantanee. Separee de la
// recherche Fragrantica pour que l'utilisateur voie ces resultats tout de
// suite sans attendre la requete reseau, plus lente et moins fiable.
export async function searchLocalPerfumesAction(query: string) {
  await requireUser();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  return findPerfumesByName(trimmed);
}

// Recherche libre pour la page /discover (version detaillee de la section
// Decouvrir de l'accueil).
export async function searchDiscoverPerfumesAction(query: string) {
  await requireUser();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  return searchReferencePerfumes(trimmed);
}

// Nouveau tirage aleatoire sans quitter /discover (bouton "Autre selection").
export async function refreshDiscoverPerfumesAction() {
  const user = await requireUser();
  const gender = await getUserGenderPreference(user.id);
  return getDiscoverPerfumes(user.id, gender, 30);
}

// Etape 1b : propose des fiches Fragrantica non encore connues. Deux sources
// combinees : le dataset public importe dans `fragrantica_reference` (fiable,
// pas de reseau) et la recherche live DuckDuckGo->Fragrantica (moins fiable,
// voir lib/fragrantica.ts) -- un echec de la seconde ne doit jamais empecher
// la premiere de repondre. Isolee dans sa propre action pour qu'une lenteur
// reseau n'empeche pas d'afficher les resultats locaux (searchLocalPerfumesAction).
export async function searchFragranticaCandidatesAction(query: string) {
  await requireUser();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const [referenceCandidates, liveCandidates] = await Promise.all([
    searchFragranticaReference(trimmed),
    searchFragrantica(trimmed).catch(() => []),
  ]);

  const seen = new Set<string>();
  const merged: FragranticaCandidate[] = [];
  for (const c of [...referenceCandidates, ...liveCandidates]) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    merged.push(c);
  }

  const knownUrls = new Set(
    (await Promise.all(merged.map((c) => findPerfumeByFragranticaUrl(c.url))))
      .filter(Boolean)
      .map((p) => p!.fragranticaUrl)
  );

  return merged.filter((c) => !knownUrls.has(c.url)).slice(0, 20);
}

// Etape 2 : l'utilisateur choisit une fiche precise. Cache hit -> renvoie le
// parfum existant directement. Sinon, priorite au dataset local (fiable,
// notes deja connues, pas de reseau) ; en dernier recours seulement, scraping
// live de Fragrantica. Dans tous les cas rien n'est ecrit en base ici -- seul
// savePerfumeAction (etape 3, apres confirmation utilisateur) ecrit.
export async function resolvePerfumeAction(
  fragranticaUrl: string
): Promise<{ existingId: number } | { draft: ScrapedPerfume }> {
  await requireUser();

  const existing = await findPerfumeByFragranticaUrl(fragranticaUrl);
  if (existing) return { existingId: existing.id };

  const reference = await findReferenceByUrl(fragranticaUrl);
  if (reference) {
    return {
      draft: {
        name: reference.name,
        brand: reference.brand,
        gender: reference.gender,
        imageUrl: null,
        fragranticaUrl: reference.fragranticaUrl,
        notes: {
          top: splitNotesList(reference.notesTop),
          heart: splitNotesList(reference.notesHeart),
          base: splitNotesList(reference.notesBase),
        },
      },
    };
  }

  const draft = await scrapeFragranticaPerfume(fragranticaUrl);
  return { draft };
}

export type SavePerfumeInput = {
  draft: ScrapedPerfume;
  price: number | null;
  volumeMl: number;
  concentration: Concentration;
  gender: Gender;
  tags: Tag[];
};

// Etape 3 : l'utilisateur valide le brouillon (potentiellement corrige) ->
// seul moment ou on ecrit en base, comme acte dans roadmap.md section 5.
export async function savePerfumeAction(input: SavePerfumeInput): Promise<number> {
  await requireUser();

  const existing = await findPerfumeByFragranticaUrl(input.draft.fragranticaUrl);
  if (existing) return existing.id;

  // Ni le dataset local (fragrantica_reference) ni le scraping Fragrantica
  // ne donnent de description utilisable (le champ "description" expose par
  // Fragrantica n'est qu'un gabarit qui repete les notes, aucune valeur
  // ajoutee) -- Wikipedia est donc la seule source pour ce champ, tentee a
  // chaque ajout. Best-effort, ne doit jamais faire echouer l'ajout.
  const wiki = await findWikipediaPerfumeInfo(input.draft.name).catch(
    () => ({ image: null, description: null }) as const
  );

  const imageSourceUrl = input.draft.imageUrl ?? wiki.image;
  const imagePublicId = imageSourceUrl ? await uploadImageFromUrl(imageSourceUrl, "perfumes") : null;

  return insertPerfumeRow({
    name: input.draft.name,
    brand: input.draft.brand,
    imagePublicId,
    fragranticaUrl: input.draft.fragranticaUrl,
    inspiredBy: null,
    description: wiki.description,
    price: input.price,
    volumeMl: input.volumeMl,
    concentration: input.concentration,
    gender: input.gender,
    tags: input.tags,
    notes: input.draft.notes,
  });
}

// Resout (dataset local, jamais de scraping ici) puis ecrit un parfum issu
// de Decouvrir ou d'une page marque -- meme dataset que la recherche, mais
// pas de brouillon a confirmer/annuler comme resolvePerfumeAction : ces deux
// ecrans montrent deja la fiche complete avant d'appeler cette fonction (voir
// ReferencePerfumeSheet), donc resolution et ecriture sont composees
// directement. `overrides` porte ce que l'utilisateur a saisi a la main
// (prix, description) dans ce meme ecran -- prioritaire sur Wikipedia, sans
// jamais ecraser une valeur existante avec `null` si l'utilisateur laisse le
// champ vide.
async function resolveAndSaveReferencePerfume(
  fragranticaUrl: string,
  overrides: { price: number | null; description: string | null }
): Promise<number> {
  const existing = await findPerfumeByFragranticaUrl(fragranticaUrl);
  if (existing) {
    if (overrides.price != null || overrides.description != null) {
      await db
        .update(perfumes)
        .set({
          ...(overrides.price != null ? { price: overrides.price } : {}),
          ...(overrides.description != null ? { description: overrides.description } : {}),
        })
        .where(eq(perfumes.id, existing.id));
    }
    return existing.id;
  }

  const reference = await findReferenceByUrl(fragranticaUrl);
  if (!reference) throw new Error("Parfum introuvable");

  const wiki = overrides.description
    ? { image: null, description: null }
    : await findWikipediaPerfumeInfo(reference.name).catch(() => ({ image: null, description: null }) as const);

  const imagePublicId = wiki.image ? await uploadImageFromUrl(wiki.image, "perfumes") : null;

  return insertPerfumeRow({
    name: reference.name,
    brand: reference.brand,
    imagePublicId,
    fragranticaUrl: reference.fragranticaUrl,
    inspiredBy: null,
    description: overrides.description ?? wiki.description,
    price: overrides.price,
    volumeMl: 100,
    concentration: guessConcentration(reference.name),
    gender: reference.gender,
    tags: [],
    notes: {
      top: splitNotesList(reference.notesTop),
      heart: splitNotesList(reference.notesHeart),
      base: splitNotesList(reference.notesBase),
    },
  });
}

export type SaveReferencePerfumeInput = {
  fragranticaUrl: string;
  price: number | null;
  description: string | null;
  toCollection: boolean;
  wishlistIds: number[];
};

// Decouvrir et les pages marque n'ont pas de "target" unique comme
// AddPerfumeDialog (collection OU une wishlist precise) : l'utilisateur voit
// la fiche complete du parfum d'abord (ReferencePerfumeSheet), puis choisit
// librement collection et/ou une ou plusieurs wishlists avant d'ecrire quoi
// que ce soit.
export async function saveReferencePerfumeAction(input: SaveReferencePerfumeInput): Promise<void> {
  const user = await requireUser();
  if (!input.toCollection && input.wishlistIds.length === 0) {
    throw new Error("Choisis au moins une destination");
  }

  const perfumeId = await resolveAndSaveReferencePerfume(input.fragranticaUrl, {
    price: input.price,
    description: input.description,
  });

  if (input.toCollection) {
    await db.insert(collectionItems).values({ userId: user.id, perfumeId }).onConflictDoNothing();
  }
  for (const wishlistId of input.wishlistIds) {
    await addItemToWishlistAction(wishlistId, perfumeId);
  }

  revalidatePath("/");
  revalidatePath("/collection");
}

// Corrige apres coup un prix/une description manquants (ou faux) sur
// N'IMPORTE quel parfum, pas seulement les fiches manuelles -- `perfumes`
// est un catalogue commun sans notion de proprietaire (meme acceptation que
// updateManualPerfumeAction ci-dessous). Ni le dataset local ni Fragrantica
// n'exposent ces deux champs de facon fiable (voir PROJECT.md), donc une
// bonne partie des fiches issues de la recherche/Decouvrir en manquent --
// ce filet de rattrapage est la reponse retenue plutot que d'aller chercher
// une source de prix qui n'existe pas gratuitement.
export async function updatePerfumeExtrasAction(
  perfumeId: number,
  input: { price: number | null; description: string | null }
): Promise<void> {
  await requireUser();
  await db
    .update(perfumes)
    .set({ price: input.price, description: input.description?.trim() || null })
    .where(eq(perfumes.id, perfumeId));
  revalidatePath("/");
  revalidatePath("/collection");
}

export type ManualPerfumeInput = {
  name: string;
  brand: string;
  imagePublicId: string | null;
  inspiredBy: string | null;
  price: number | null;
  volumeMl: number;
  concentration: Concentration;
  gender: Gender;
  tags: Tag[];
  notes: { top: string[]; heart: string[]; base: string[] };
};

// Parfum introuvable sur Fragrantica (ou recherche indisponible) : l'utilisateur
// saisit tout lui-meme. Meme chemin d'ecriture que le scraping, juste sans
// fragranticaUrl et avec une image uploadee directement (uploadPerfumeImageAction).
export async function createManualPerfumeAction(input: ManualPerfumeInput): Promise<number> {
  await requireUser();
  if (!input.name.trim() || !input.brand.trim()) throw new Error("Nom et marque requis");

  return insertPerfumeRow({
    name: input.name.trim(),
    brand: input.brand.trim(),
    imagePublicId: input.imagePublicId,
    fragranticaUrl: null,
    inspiredBy: input.inspiredBy?.trim() || null,
    description: null,
    price: input.price,
    volumeMl: input.volumeMl,
    concentration: input.concentration,
    gender: input.gender,
    tags: input.tags,
    notes: input.notes,
  });
}

// Edition d'un parfum saisi manuellement : remplace entierement ses notes/tags
// (plus simple et plus sur qu'un diff) et met a jour la fiche partagee. Comme
// `perfumes` est un catalogue commun sans notion de proprietaire, n'importe
// quel utilisateur connecte peut corriger une fiche manuelle existante -
// acceptable a l'echelle perso de ce projet (pas de colonne createdBy).
export async function updateManualPerfumeAction(perfumeId: number, input: ManualPerfumeInput): Promise<void> {
  await requireUser();
  if (!input.name.trim() || !input.brand.trim()) throw new Error("Nom et marque requis");

  await db
    .update(perfumes)
    .set({
      name: input.name.trim(),
      brand: input.brand.trim(),
      imagePublicId: input.imagePublicId,
      inspiredBy: input.inspiredBy?.trim() || null,
      price: input.price,
      volumeMl: input.volumeMl,
      concentration: input.concentration,
      gender: input.gender,
    })
    .where(eq(perfumes.id, perfumeId));

  await db.delete(perfumeNotes).where(eq(perfumeNotes.perfumeId, perfumeId));
  await db.delete(perfumeTags).where(eq(perfumeTags.perfumeId, perfumeId));

  await Promise.all([
    insertNotes(perfumeId, "top", input.notes.top),
    insertNotes(perfumeId, "heart", input.notes.heart),
    insertNotes(perfumeId, "base", input.notes.base),
    input.tags.length > 0
      ? db.insert(perfumeTags).values(input.tags.map((tag) => ({ perfumeId, tag })))
      : Promise.resolve(),
  ]);

  revalidatePath("/", "layout");
}

export async function uploadPerfumeImageAction(file: File): Promise<string> {
  await requireUser();
  if (!file.type.startsWith("image/")) throw new Error("Le fichier doit etre une image");
  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadImageFromBuffer(buffer, "perfumes");
}

async function insertPerfumeRow(input: {
  name: string;
  brand: string;
  imagePublicId: string | null;
  fragranticaUrl: string | null;
  inspiredBy: string | null;
  description: string | null;
  price: number | null;
  volumeMl: number;
  concentration: Concentration;
  gender: Gender;
  tags: Tag[];
  notes: { top: string[]; heart: string[]; base: string[] };
}): Promise<number> {
  const [perfume] = await db
    .insert(perfumes)
    .values({
      name: input.name,
      brand: input.brand,
      imagePublicId: input.imagePublicId,
      fragranticaUrl: input.fragranticaUrl,
      inspiredBy: input.inspiredBy,
      description: input.description,
      price: input.price,
      volumeMl: input.volumeMl,
      concentration: input.concentration,
      gender: input.gender,
    })
    .returning();

  await Promise.all([
    insertNotes(perfume.id, "top", input.notes.top),
    insertNotes(perfume.id, "heart", input.notes.heart),
    insertNotes(perfume.id, "base", input.notes.base),
    input.tags.length > 0
      ? db.insert(perfumeTags).values(input.tags.map((tag) => ({ perfumeId: perfume.id, tag })))
      : Promise.resolve(),
  ]);

  return perfume.id;
}

async function insertNotes(perfumeId: number, type: "top" | "heart" | "base", names: string[]) {
  for (const name of names) {
    const noteId = await getOrCreateNoteId(name);
    await db.insert(perfumeNotes).values({ perfumeId, noteId, type }).onConflictDoNothing();
  }
}

async function getOrCreateNoteId(name: string): Promise<number> {
  const [existing] = await db.select().from(notes).where(eq(notes.name, name));
  if (existing) return existing.id;

  // onConflictDoNothing : deux notes identiques (ex: meme note en top ET en
  // coeur) peuvent etre creees en parallele, cf Promise.all dans savePerfumeAction.
  const [created] = await db.insert(notes).values({ name }).onConflictDoNothing().returning();
  if (created) return created.id;

  const [row] = await db.select().from(notes).where(eq(notes.name, name));
  return row.id;
}
