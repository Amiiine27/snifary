"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { perfumes, notes, perfumeNotes, perfumeTags } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { searchFragrantica, scrapeFragranticaPerfume, type ScrapedPerfume } from "@/lib/fragrantica";
import { uploadImageFromUrl, uploadImageFromBuffer } from "@/lib/cloudinary";
import { findPerfumesByName, findPerfumeByFragranticaUrl } from "@/lib/perfumes";

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

// Etape 1b : propose des fiches Fragrantica non encore connues. Isolee dans
// sa propre action pour qu'un echec ou une lenteur reseau n'empeche pas
// d'afficher les resultats locaux.
export async function searchFragranticaCandidatesAction(query: string) {
  await requireUser();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const candidates = await searchFragrantica(trimmed);

  const knownUrls = new Set(
    (await Promise.all(candidates.map((c) => findPerfumeByFragranticaUrl(c.url))))
      .filter(Boolean)
      .map((p) => p!.fragranticaUrl)
  );

  return candidates.filter((c) => !knownUrls.has(c.url));
}

// Etape 2 : l'utilisateur choisit une fiche Fragrantica precise. Cache hit ->
// renvoie le parfum existant directement. Sinon on scrape et on renvoie un
// brouillon a valider (rien n'est ecrit en base a ce stade).
export async function resolvePerfumeAction(
  fragranticaUrl: string
): Promise<{ existingId: number } | { draft: ScrapedPerfume }> {
  await requireUser();

  const existing = await findPerfumeByFragranticaUrl(fragranticaUrl);
  if (existing) return { existingId: existing.id };

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

  const imagePublicId = input.draft.imageUrl
    ? await uploadImageFromUrl(input.draft.imageUrl, "perfumes")
    : null;

  return insertPerfumeRow({
    name: input.draft.name,
    brand: input.draft.brand,
    imagePublicId,
    fragranticaUrl: input.draft.fragranticaUrl,
    inspiredBy: null,
    price: input.price,
    volumeMl: input.volumeMl,
    concentration: input.concentration,
    gender: input.gender,
    tags: input.tags,
    notes: input.draft.notes,
  });
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
