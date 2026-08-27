"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { wishlists, wishlistItems, collectionItems } from "@/db/schema";
import { requireUser } from "@/lib/session";

export async function createWishlistAction(name: string) {
  const user = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom de la wishlist est requis");

  const [{ maxPosition }] = await db
    .select({ maxPosition: sql<number>`coalesce(max(${wishlists.position}), -1)` })
    .from(wishlists)
    .where(eq(wishlists.userId, user.id));

  await db.insert(wishlists).values({ userId: user.id, name: trimmed, position: maxPosition + 1 });
  revalidatePath("/");
}

export async function renameWishlistAction(wishlistId: number, name: string) {
  const user = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom de la wishlist est requis");
  await db
    .update(wishlists)
    .set({ name: trimmed })
    .where(and(eq(wishlists.id, wishlistId), eq(wishlists.userId, user.id)));
  revalidatePath("/");
}

export async function deleteWishlistAction(wishlistId: number) {
  const user = await requireUser();
  await db.delete(wishlists).where(and(eq(wishlists.id, wishlistId), eq(wishlists.userId, user.id)));
  revalidatePath("/");
  // La suppression depuis la vue wishlist redirige vers la collection
  // (voir DeleteWishlistButton) -- revalidee explicitement pour ne pas
  // servir une version en cache du router qui listerait encore cette
  // wishlist dans son carrousel prev/next.
  revalidatePath("/library/collection");
}

export async function addItemToWishlistAction(wishlistId: number, perfumeId: number) {
  const user = await requireUser();
  const [owned] = await db
    .select()
    .from(wishlists)
    .where(and(eq(wishlists.id, wishlistId), eq(wishlists.userId, user.id)));
  if (!owned) throw new Error("Wishlist introuvable");

  await db.insert(wishlistItems).values({ wishlistId, perfumeId }).onConflictDoNothing();
  revalidatePath("/");
}

export async function removeItemFromWishlistAction(itemId: number) {
  const user = await requireUser();
  await assertWishlistItemOwnedByUser(itemId, user.id);
  await db.delete(wishlistItems).where(eq(wishlistItems.id, itemId));
  revalidatePath("/");
}

// "Je l'ai achete" : bascule un parfum d'une wishlist vers la collection possedee.
export async function moveWishlistItemToCollectionAction(itemId: number, perfumeId: number) {
  const user = await requireUser();
  await assertWishlistItemOwnedByUser(itemId, user.id);
  await db.insert(collectionItems).values({ userId: user.id, perfumeId }).onConflictDoNothing();
  await db.delete(wishlistItems).where(eq(wishlistItems.id, itemId));
  revalidatePath("/");
  revalidatePath("/collection");
}

// Empeche un itemId devine de toucher les wishlists d'un autre utilisateur.
async function assertWishlistItemOwnedByUser(itemId: number, userId: string) {
  const [row] = await db
    .select({ id: wishlistItems.id })
    .from(wishlistItems)
    .innerJoin(wishlists, eq(wishlists.id, wishlistItems.wishlistId))
    .where(and(eq(wishlistItems.id, itemId), eq(wishlists.userId, userId)));
  if (!row) throw new Error("Item introuvable");
}

// Reordonne les wishlists sur l'accueil (fleches haut/bas). Simple echange
// de `position` avec la voisine plutot qu'une renumerotation complete de la
// liste -- suffisant ici, pas de trous ni de doublons possibles puisque
// `createWishlistAction` incremente toujours depuis le max existant.
export async function moveWishlistAction(wishlistId: number, direction: "up" | "down"): Promise<void> {
  const user = await requireUser();
  const userWishlists = await db
    .select()
    .from(wishlists)
    .where(eq(wishlists.userId, user.id))
    .orderBy(wishlists.position);

  const index = userWishlists.findIndex((w) => w.id === wishlistId);
  if (index === -1) return; // pas trouvee (ou pas a cet utilisateur) : no-op silencieux

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= userWishlists.length) return;

  const current = userWishlists[index];
  const neighbor = userWishlists[swapIndex];

  await db.update(wishlists).set({ position: neighbor.position }).where(eq(wishlists.id, current.id));
  await db.update(wishlists).set({ position: current.position }).where(eq(wishlists.id, neighbor.id));

  revalidatePath("/");
}
