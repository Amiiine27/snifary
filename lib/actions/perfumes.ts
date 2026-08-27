"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { perfumes, notes, perfumeNotes, perfumeTags } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { searchFragrantica, scrapeFragranticaPerfume, type ScrapedPerfume } from "@/lib/fragrantica";
import { uploadImageFromUrl } from "@/lib/cloudinary";
import { findPerfumesByName, findPerfumeByFragranticaUrl } from "@/lib/perfumes";

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
  concentration: "edt" | "edp" | "parfum" | "extrait" | "cologne" | null;
  gender: "homme" | "femme" | "unisexe";
  tags: ("printemps" | "ete" | "automne" | "hiver" | "jour" | "nuit")[];
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

  const [perfume] = await db
    .insert(perfumes)
    .values({
      name: input.draft.name,
      brand: input.draft.brand,
      imagePublicId,
      fragranticaUrl: input.draft.fragranticaUrl,
      price: input.price,
      volumeMl: input.volumeMl,
      concentration: input.concentration,
      gender: input.gender,
    })
    .returning();

  await Promise.all([
    insertNotes(perfume.id, "top", input.draft.notes.top),
    insertNotes(perfume.id, "heart", input.draft.notes.heart),
    insertNotes(perfume.id, "base", input.draft.notes.base),
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
