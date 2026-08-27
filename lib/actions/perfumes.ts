"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { perfumes, notes, perfumeNotes, perfumeTags, collectionItems } from "@/db/schema";
import { guessConcentration } from "@/lib/concentration";
import { splitNotesList } from "@/lib/notes";
import { requireUser } from "@/lib/session";
import { findFimgsImage, type ScrapedPerfume } from "@/lib/fragrantica";
import { uploadImageFromUrl, uploadImageFromBuffer } from "@/lib/cloudinary";
import { findWikipediaPerfumeInfo } from "@/lib/wikipedia";
import { findOpenBeautyFactsImage } from "@/lib/openbeautyfacts";
import {
  findPerfumesByName,
  findPerfumeByFragranticaUrl,
  searchFragranticaReference,
  searchReferencePerfumes,
  findReferenceByUrl,
  getDiscoverPerfumes,
  getUserGenderPreference,
  getSimilarPerfumes,
  type SimilarPerfumeSource,
  type ReferenceCandidate,
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

// "Vous pourriez aimer" -- affichee sur toutes les fiches parfum (possedees
// ou pas encore). `source` vient soit d'un PerfumeDetails deja en base, soit
// d'un ReferencePerfume pas encore ajoute : les deux ont deja la meme forme
// {name, brand, gender, notes}, pas de conversion necessaire cote appelant.
export async function getSimilarPerfumesAction(source: SimilarPerfumeSource) {
  const user = await requireUser();
  return getSimilarPerfumes(source, user.id);
}

// Nouveau tirage aleatoire sans quitter /discover (bouton "Autre selection").
export async function refreshDiscoverPerfumesAction() {
  const user = await requireUser();
  const gender = await getUserGenderPreference(user.id);
  return getDiscoverPerfumes(user.id, gender, 30);
}

// Etape 1b : propose des fiches du dataset local non encore connues. Le
// scraping live DuckDuckGo->Fragrantica a ete retire (fragrantica.com est
// desormais derriere un vrai challenge Cloudflare, voir lib/fragrantica.ts) --
// le dataset `fragrantica_reference` (~24k parfums, notes + image via
// fimgs.net) suffit maintenant a lui seul pour l'immense majorite des
// recherches. Exclut les candidats deja enregistres (`perfumes`) : ils
// remontent deja via searchLocalPerfumesAction, pas la peine de les montrer
// deux fois dans une liste desormais fusionnee cote UI (plus de distinction
// visuelle "deja dans Snifary" / "sur Fragrantica").
export async function searchFragranticaCandidatesAction(query: string): Promise<ReferenceCandidate[]> {
  await requireUser();
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const candidates = await searchFragranticaReference(trimmed);

  const knownUrls = new Set(
    (await Promise.all(candidates.map((c) => findPerfumeByFragranticaUrl(c.url))))
      .filter(Boolean)
      .map((p) => p!.fragranticaUrl)
  );

  return candidates.filter((c) => !knownUrls.has(c.url)).slice(0, 20);
}

// Etape 2 : l'utilisateur choisit une fiche precise. Cache hit -> renvoie le
// parfum existant directement. Sinon, resolution via le dataset local (seule
// source restante, plus de scraping live en dernier recours -- voir
// searchFragranticaCandidatesAction). Rien n'est ecrit en base ici -- seul
// savePerfumeAction (etape 3, apres confirmation utilisateur) ecrit.
export async function resolvePerfumeAction(
  fragranticaUrl: string
): Promise<{ existingId: number } | { draft: ScrapedPerfume }> {
  await requireUser();

  const existing = await findPerfumeByFragranticaUrl(fragranticaUrl);
  if (existing) return { existingId: existing.id };

  const reference = await findReferenceByUrl(fragranticaUrl);
  if (!reference) throw new Error("Parfum introuvable");

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

export type SavePerfumeInput = {
  draft: ScrapedPerfume;
  price: number | null;
  volumeMl: number;
  concentration: Concentration;
  gender: Gender;
  tags: Tag[];
};

// Image + description pour un parfum qu'on s'apprete a ecrire en base.
// Quatre sources, dans cet ordre de priorite pour l'image :
//  1. Une image deja trouvee (scraping Fragrantica live) -- rare aujourd'hui,
//     la plupart des ajouts passent par le dataset local qui n'en a jamais.
//  2. Le CDN images de Fragrantica (fimgs.net, lib/fragrantica.ts) : construit
//     a partir de l'id dans fragranticaUrl, verifie par HEAD avant de s'y fier
//     (voir findFimgsImage) -- correspondance exacte, pas de risque de faux
//     positif contrairement aux deux sources suivantes qui matchent par nom.
//     Couvre la quasi-totalite des ajouts passant par le dataset local.
//  3. Open Beauty Facts (lib/openbeautyfacts.ts) : vraie photo produit, base
//     ouverte a l'usage programmatique. Solide sur les grosses marques,
//     quasi vide sur le niche (verifie manuellement).
//  4. Wikipedia (lib/wikipedia.ts) : filet de secours, tres restrictif.
// La description ne vient que de Wikipedia (seule source des trois a en
// avoir une). Tous les appels reseau tournent en parallele, jamais bloquant.
async function findImageAndDescription(
  name: string,
  brand: string,
  fragranticaUrl: string,
  existingImageUrl: string | null
): Promise<{ imageUrl: string | null; description: string | null }> {
  if (existingImageUrl) {
    const wiki = await findWikipediaPerfumeInfo(name).catch(() => ({ image: null, description: null }) as const);
    return { imageUrl: existingImageUrl, description: wiki.description };
  }

  const [fimgsImage, obfImage, wiki] = await Promise.all([
    findFimgsImage(fragranticaUrl).catch(() => null),
    findOpenBeautyFactsImage(name, brand).catch(() => null),
    findWikipediaPerfumeInfo(name).catch(() => ({ image: null, description: null }) as const),
  ]);

  return { imageUrl: fimgsImage ?? obfImage ?? wiki.image, description: wiki.description };
}

// Etape 3 : l'utilisateur valide le brouillon (potentiellement corrige) ->
// seul moment ou on ecrit en base, comme acte dans roadmap.md section 5.
export async function savePerfumeAction(input: SavePerfumeInput): Promise<number> {
  await requireUser();

  const existing = await findPerfumeByFragranticaUrl(input.draft.fragranticaUrl);
  if (existing) return existing.id;

  const { imageUrl, description } = await findImageAndDescription(
    input.draft.name,
    input.draft.brand,
    input.draft.fragranticaUrl,
    input.draft.imageUrl
  );

  const imagePublicId = imageUrl ? await uploadImageFromUrl(imageUrl, "perfumes") : null;

  return insertPerfumeRow({
    name: input.draft.name,
    brand: input.draft.brand,
    imagePublicId,
    fragranticaUrl: input.draft.fragranticaUrl,
    inspiredBy: null,
    description,
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
// directement. `price` est le seul champ saisi a la main dans ce meme ecran
// (la description n'est jamais demandee a l'utilisateur, voir
// findImageAndDescription -- trouvee automatiquement ou laissee vide).
async function resolveAndSaveReferencePerfume(fragranticaUrl: string, price: number | null): Promise<number> {
  const existing = await findPerfumeByFragranticaUrl(fragranticaUrl);
  if (existing) {
    if (price != null) {
      await db.update(perfumes).set({ price }).where(eq(perfumes.id, existing.id));
    }
    return existing.id;
  }

  const reference = await findReferenceByUrl(fragranticaUrl);
  if (!reference) throw new Error("Parfum introuvable");

  const { imageUrl, description } = await findImageAndDescription(
    reference.name,
    reference.brand,
    reference.fragranticaUrl,
    null
  );
  const imagePublicId = imageUrl ? await uploadImageFromUrl(imageUrl, "perfumes") : null;

  return insertPerfumeRow({
    name: reference.name,
    brand: reference.brand,
    imagePublicId,
    fragranticaUrl: reference.fragranticaUrl,
    inspiredBy: null,
    description,
    price,
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

  const perfumeId = await resolveAndSaveReferencePerfume(input.fragranticaUrl, input.price);

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

// Meme logique que updatePerfumeExtrasAction, pour l'image : la plupart des
// parfums issus de la recherche/Decouvrir/pages marque n'en ont pas
// (fragrantica_reference n'en a jamais, Wikipedia n'en trouve que pour
// ~10-15%, voir PROJECT.md), et n'importe quel utilisateur connecte peut
// desormais en ajouter une depuis PerfumeDetailSheet -- pas seulement pour
// les fiches manuelles comme via "Modifier".
export async function updatePerfumeImageAction(perfumeId: number, imagePublicId: string): Promise<void> {
  await requireUser();
  await db.update(perfumes).set({ imagePublicId }).where(eq(perfumes.id, perfumeId));
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
