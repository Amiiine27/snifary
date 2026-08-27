import "server-only";
import { eq, inArray, like, or } from "drizzle-orm";
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
} from "@/db/schema";
import { cloudinaryUrl } from "@/lib/cloudinary";

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
export type ReferenceCandidate = { url: string; title: string };

export async function searchFragranticaReference(query: string): Promise<ReferenceCandidate[]> {
  const term = `%${query.trim()}%`;
  const rows = await db
    .select()
    .from(fragranticaReference)
    .where(or(like(fragranticaReference.name, term), like(fragranticaReference.brand, term)))
    .limit(15);
  return rows.map((r) => ({ url: r.fragranticaUrl, title: `${r.name} — ${r.brand}` }));
}

export async function findReferenceByUrl(url: string) {
  const [row] = await db.select().from(fragranticaReference).where(eq(fragranticaReference.fragranticaUrl, url));
  return row ?? null;
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
