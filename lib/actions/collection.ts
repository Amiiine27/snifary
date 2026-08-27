"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { collectionItems } from "@/db/schema";
import { requireUser } from "@/lib/session";

export async function addToCollectionAction(perfumeId: number) {
  const user = await requireUser();
  await db
    .insert(collectionItems)
    .values({ userId: user.id, perfumeId })
    .onConflictDoNothing();
  revalidatePath("/");
  revalidatePath("/collection");
}

export async function removeFromCollectionAction(itemId: number) {
  const user = await requireUser();
  await db
    .delete(collectionItems)
    .where(and(eq(collectionItems.id, itemId), eq(collectionItems.userId, user.id)));
  revalidatePath("/");
  revalidatePath("/collection");
}

export async function updatePersonalNoteAction(itemId: number, personalNote: string) {
  const user = await requireUser();
  await db
    .update(collectionItems)
    .set({ personalNote: personalNote.trim() || null })
    .where(and(eq(collectionItems.id, itemId), eq(collectionItems.userId, user.id)));
  revalidatePath("/collection");
}
