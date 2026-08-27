import "server-only";
import { and, eq, inArray, like, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  perfumes,
  notes,
  perfumeNotes,
  perfumeTags,
  collectionItems,
  wishlists,
  wishlistItems,
  fragranticaReference,
  userPreferences,
} from "@/db/schema";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { splitNotesList } from "@/lib/notes";
import { fimgsImageUrl } from "@/lib/fragrantica";

export type PerfumeCard = {
  id: number;
  name: string;
  brand: string;
  imageUrl: string | null;
  price: number | null;
  volumeMl: number;
  gender: "homme" | "femme" | "unisexe";
};

export type PerfumeDetails = PerfumeCard & {
  imagePublicId: string | null;
  concentration: string | null;
  fragranticaUrl: string | null;
  inspiredBy: string | null;
  description: string | null;
  tags: string[];
  notes: { top: string[]; heart: string[]; base: string[] };
};

function toCard(p: typeof perfumes.$inferSelect): PerfumeCard {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    imageUrl: cloudinaryUrl(p.imagePublicId),
    price: p.price,
    volumeMl: p.volumeMl,
    gender: p.gender,
  };
}

// Regroupe les notes olfactives et tags de plusieurs parfums en une seule
// paire de requetes (evite le N+1 quand on affiche une liste de cards).
async function attachDetails(rows: (typeof perfumes.$inferSelect)[]): Promise<PerfumeDetails[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [noteRows, tagRows] = await Promise.all([
    db
      .select({ perfumeId: perfumeNotes.perfumeId, type: perfumeNotes.type, name: notes.name })
      .from(perfumeNotes)
      .innerJoin(notes, eq(notes.id, perfumeNotes.noteId))
      .where(inArray(perfumeNotes.perfumeId, ids)),
    db
      .select({ perfumeId: perfumeTags.perfumeId, tag: perfumeTags.tag })
      .from(perfumeTags)
      .where(inArray(perfumeTags.perfumeId, ids)),
  ]);

  return rows.map((p) => ({
    ...toCard(p),
    imagePublicId: p.imagePublicId,
    concentration: p.concentration,
    fragranticaUrl: p.fragranticaUrl,
    inspiredBy: p.inspiredBy,
    description: p.description,
    tags: tagRows.filter((t) => t.perfumeId === p.id).map((t) => t.tag),
    notes: {
      top: noteRows.filter((n) => n.perfumeId === p.id && n.type === "top").map((n) => n.name),
      heart: noteRows.filter((n) => n.perfumeId === p.id && n.type === "heart").map((n) => n.name),
      base: noteRows.filter((n) => n.perfumeId === p.id && n.type === "base").map((n) => n.name),
    },
  }));
}

export async function getPerfumeDetails(perfumeId: number): Promise<PerfumeDetails | null> {
  const [row] = await db.select().from(perfumes).where(eq(perfumes.id, perfumeId));
  if (!row) return null;
  const [details] = await attachDetails([row]);
  return details;
}

export async function findPerfumesByName(query: string): Promise<PerfumeCard[]> {
  const term = `%${query.trim()}%`;
  const rows = await db
    .select()
    .from(perfumes)
    .where(or(like(perfumes.name, term), like(perfumes.brand, term)))
    .limit(10);
  return rows.map(toCard);
}

export async function findPerfumeByFragranticaUrl(url: string) {
  const [row] = await db.select().from(perfumes).where(eq(perfumes.fragranticaUrl, url));
  return row ?? null;
}

// fragrantica_reference : dataset public importe une fois (voir db/schema.ts),
// sert uniquement de source de recherche pour l'ajout -- une ligne trouvee ici
// n'est jamais ecrite dans `perfumes` tant que l'utilisateur n'a pas confirme
// (voir resolvePerfumeAction / savePerfumeAction dans lib/actions/perfumes.ts).
export type ReferenceCandidate = { url: string; name: string; brand: string; imageUrl: string | null };

export async function searchFragranticaReference(query: string): Promise<ReferenceCandidate[]> {
  const term = `%${query.trim()}%`;
  const rows = await db
    .select()
    .from(fragranticaReference)
    .where(or(like(fragranticaReference.name, term), like(fragranticaReference.brand, term)))
    .limit(15);
  return rows.map((r) => ({
    url: r.fragranticaUrl,
    name: r.name,
    brand: r.brand,
    imageUrl: fimgsImageUrl(r.fragranticaUrl),
  }));
}

export async function findReferenceByUrl(url: string) {
  const [row] = await db.select().from(fragranticaReference).where(eq(fragranticaReference.fragranticaUrl, url));
  return row ?? null;
}

export type ReferencePerfume = {
  fragranticaUrl: string;
  name: string;
  brand: string;
  gender: "homme" | "femme" | "unisexe";
  imageUrl: string | null;
  notes: { top: string[]; heart: string[]; base: string[] };
};

function toReferencePerfume(r: typeof fragranticaReference.$inferSelect): ReferencePerfume {
  return {
    fragranticaUrl: r.fragranticaUrl,
    name: r.name,
    brand: r.brand,
    gender: r.gender,
    // Construite a partir de l'id Fragrantica, jamais verifiee ici (voir
    // fimgsImageUrl) -- l'UI gere le rare cas d'echec avec un repli visuel
    // (onError), pas la peine d'un aller-retour reseau pour chaque ligne
    // d'une liste de 30+ resultats.
    imageUrl: fimgsImageUrl(r.fragranticaUrl),
    notes: {
      top: splitNotesList(r.notesTop),
      heart: splitNotesList(r.notesHeart),
      base: splitNotesList(r.notesBase),
    },
  };
}

export async function getUserGenderPreference(userId: string): Promise<"homme" | "femme" | "unisexe"> {
  const [row] = await db
    .select({ genderPreference: userPreferences.genderPreference })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));
  return row?.genderPreference ?? "unisexe";
}

// Section "Decouvrir" (accueil ET page /discover) : tirage aleatoire dans le
// dataset local (fragrantica_reference, ~24k parfums toutes marques), filtre
// par genre prefere (unisexe = pas de filtre), en excluant ce que
// l'utilisateur possede deja. Tape dessus -> ReferencePerfumeSheet (fiche
// complete, choix collection/wishlist(s) avant d'ecrire quoi que ce soit).
export async function getDiscoverPerfumes(
  userId: string,
  gender: "homme" | "femme" | "unisexe",
  limit = 12
): Promise<ReferencePerfume[]> {
  const owned = await db
    .select({ url: perfumes.fragranticaUrl })
    .from(collectionItems)
    .innerJoin(perfumes, eq(perfumes.id, collectionItems.perfumeId))
    .where(eq(collectionItems.userId, userId));
  const ownedUrls = owned.map((o) => o.url).filter((u): u is string => u !== null);

  const conditions = [
    gender === "unisexe" ? undefined : or(eq(fragranticaReference.gender, gender), eq(fragranticaReference.gender, "unisexe")),
    ownedUrls.length > 0 ? notInArray(fragranticaReference.fragranticaUrl, ownedUrls) : undefined,
  ].filter((c) => c !== undefined);

  const rows = await db
    .select()
    .from(fragranticaReference)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`RANDOM()`)
    .limit(limit);

  return rows.map(toReferencePerfume);
}

// Page marque : tout le catalogue local d'une marque (dataset, pas
// seulement ce qui est deja dans Snifary). Comparaison insensible a la
// casse -- le nom de marque affiche cote UI (perfume.brand) peut venir du
// scraping live, du dataset, ou d'une saisie manuelle, dont la casse n'est
// pas garantie identique au dataset.
export async function getBrandCatalog(brand: string): Promise<ReferencePerfume[]> {
  const rows = await db
    .select()
    .from(fragranticaReference)
    .where(sql`lower(${fragranticaReference.brand}) = lower(${brand})`)
    .orderBy(fragranticaReference.name);
  return rows.map(toReferencePerfume);
}

// Recherche libre dans le dataset local pour la page /discover (version
// "poussee" de la section Decouvrir de l'accueil) -- pas de filtre genre ici,
// meme logique que la recherche principale (searchFragranticaReference) ou
// une recherche par nom/marque doit tout remonter, peu importe le genre.
export async function searchReferencePerfumes(query: string, limit = 30): Promise<ReferencePerfume[]> {
  const term = `%${query.trim()}%`;
  const rows = await db
    .select()
    .from(fragranticaReference)
    .where(or(like(fragranticaReference.name, term), like(fragranticaReference.brand, term)))
    .orderBy(fragranticaReference.name)
    .limit(limit);
  return rows.map(toReferencePerfume);
}

// Reduit un nom a sa "gamme" probable pour reperer des flankers de la meme
// ligne (ex: "Sauvage Eau de Parfum" et "Sauvage Elixir" -> "sauvage") en
// retirant les mentions de concentration/annee -- jamais comparee qu'a
// l'interieur d'une meme marque (voir getSimilarPerfumes), donc pas besoin
// d'etre plus precis que ça.
function productLine(name: string): string {
  return name
    .toLowerCase()
    .replace(/\beau de (parfum|toilette|cologne)\b/g, " ")
    .replace(/\b(elixir|extrait|parfum|cologne|le parfum)\b/g, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type SimilarPerfumeSource = {
  name: string;
  brand: string;
  gender: "homme" | "femme" | "unisexe";
  notes: { top: string[]; heart: string[]; base: string[] };
  excludeFragranticaUrl: string | null;
};

// "Vous pourriez aimer" sur chaque fiche parfum (deja possede ou pas encore).
// Scoring simple et explicable sur des faits reels -- pas d'IA/embeddings.
// Les NOTES dominent le classement (le but est une odeur proche, pas juste
// un autre flacon de la meme maison) : +2 par note en commun (top/heart/base
// confondus), contre seulement +1 meme marque et +1 de plus si meme "gamme"
// probable (`productLine`) -- un petit coup de pouce/depart egal en cas
// d'ex-aequo, pas le critere principal. +0.5 si le genre correspond.
// Candidats tires de `fragrantica_reference` (meme marque OU au moins une
// note commune), jamais ce que l'utilisateur possede deja -- c'est une
// section de decouverte, pas un rappel de sa collection.
export async function getSimilarPerfumes(
  source: SimilarPerfumeSource,
  userId: string,
  limit = 8
): Promise<ReferencePerfume[]> {
  const allNotes = [...source.notes.top, ...source.notes.heart, ...source.notes.base].slice(0, 12);

  const noteConditions = allNotes.map((n) => {
    const term = `%${n}%`;
    return or(
      like(fragranticaReference.notesTop, term),
      like(fragranticaReference.notesHeart, term),
      like(fragranticaReference.notesBase, term)
    );
  });

  // Deux requetes separees plutot qu'un seul OR limite : des notes courantes
  // (musk, vanilla, bergamot...) matchent des milliers de lignes sur 24k, et
  // un LIMIT unique sur l'ensemble laissait la partie "meme marque" (bien
  // plus rare) se faire evincer avant meme d'etre scoree -- verifie en test,
  // aucun resultat de la marque source ne remontait jamais.
  const [owned, brandCandidates, noteCandidates] = await Promise.all([
    db
      .select({ url: perfumes.fragranticaUrl })
      .from(collectionItems)
      .innerJoin(perfumes, eq(perfumes.id, collectionItems.perfumeId))
      .where(eq(collectionItems.userId, userId)),
    db
      .select()
      .from(fragranticaReference)
      .where(sql`lower(${fragranticaReference.brand}) = lower(${source.brand})`)
      .limit(300),
    noteConditions.length > 0
      ? db.select().from(fragranticaReference).where(or(...noteConditions)).limit(300)
      : Promise.resolve([]),
  ]);
  const ownedUrls = new Set(owned.map((o) => o.url).filter((u): u is string => u !== null));

  const seenUrls = new Set<string>();
  const candidates = [...brandCandidates, ...noteCandidates].filter((row) => {
    if (seenUrls.has(row.fragranticaUrl)) return false;
    seenUrls.add(row.fragranticaUrl);
    return true;
  });

  const sourceNotesLower = new Set(allNotes.map((n) => n.toLowerCase()));
  const sourceLine = productLine(source.name);
  const sourceBrandLower = source.brand.toLowerCase();

  const scored: { row: (typeof candidates)[number]; score: number }[] = [];
  for (const row of candidates) {
    if (source.excludeFragranticaUrl && row.fragranticaUrl === source.excludeFragranticaUrl) continue;
    if (ownedUrls.has(row.fragranticaUrl)) continue;

    // Les notes pesent plus lourd que la marque : le but est de retrouver
    // une odeur proche, pas juste un autre flacon de la meme maison --
    // demande explicite apres avoir remarque que la marque dominait trop le
    // classement (deux parfums de la meme marque sans notes en commun
    // passaient devant un parfum d'une autre marque tres proche en notes).
    const sameBrand = row.brand.toLowerCase() === sourceBrandLower;
    let score = 0;
    if (sameBrand) {
      score += 1;
      if (productLine(row.name) === sourceLine) score += 1;
    }

    const rowNotes = [...splitNotesList(row.notesTop), ...splitNotesList(row.notesHeart), ...splitNotesList(row.notesBase)];
    score += rowNotes.filter((n) => sourceNotesLower.has(n.toLowerCase())).length * 2;

    if (row.gender === source.gender || row.gender === "unisexe" || source.gender === "unisexe") score += 0.5;

    if (score > 0) scored.push({ row, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => toReferencePerfume(s.row));
}

export async function listCollection(userId: string): Promise<
  { itemId: number; personalNote: string | null; perfume: PerfumeDetails }[]
> {
  const rows = await db
    .select({ item: collectionItems, perfume: perfumes })
    .from(collectionItems)
    .innerJoin(perfumes, eq(perfumes.id, collectionItems.perfumeId))
    .where(eq(collectionItems.userId, userId));

  const details = await attachDetails(rows.map((r) => r.perfume));
  return rows.map((r, i) => ({
    itemId: r.item.id,
    personalNote: r.item.personalNote,
    perfume: details[i],
  }));
}

export async function listWishlists(userId: string): Promise<
  {
    id: number;
    name: string;
    position: number;
    items: { itemId: number; perfume: PerfumeDetails }[];
  }[]
> {
  const lists = await db
    .select()
    .from(wishlists)
    .where(eq(wishlists.userId, userId))
    .orderBy(wishlists.position);

  if (lists.length === 0) return [];

  const listIds = lists.map((l) => l.id);
  const itemRows = await db
    .select({ item: wishlistItems, perfume: perfumes })
    .from(wishlistItems)
    .innerJoin(perfumes, eq(perfumes.id, wishlistItems.perfumeId))
    .where(inArray(wishlistItems.wishlistId, listIds));

  const details = await attachDetails(itemRows.map((r) => r.perfume));

  return lists.map((list) => ({
    id: list.id,
    name: list.name,
    position: list.position,
    items: itemRows
      .map((r, i) => ({ wishlistId: r.item.wishlistId, itemId: r.item.id, perfume: details[i] }))
      .filter((r) => r.wishlistId === list.id)
      .map(({ itemId, perfume }) => ({ itemId, perfume })),
  }));
}
