"use server";

import { revalidatePath } from "next/cache";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { feedback } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";

async function requireAdmin() {
  const user = await requireUser();
  if (!isAdminEmail(user.email)) throw new Error("Non autorise");
}

export async function submitFeedbackAction(message: string) {
  const user = await requireUser();
  const trimmed = message.trim();
  if (trimmed.length < 20) {
    throw new Error("Le message doit faire au moins 20 caracteres");
  }

  await db.insert(feedback).values({
    userId: user.id,
    username: user.name,
    email: user.email,
    message: trimmed,
  });
}

export async function listAllFeedbackAction() {
  await requireAdmin();
  return db.select().from(feedback).orderBy(desc(feedback.createdAt));
}

// Requete legere dediee au badge de la cloche (AppTopBar, rendu sur chaque
// page) : pas besoin de rapatrier toutes les lignes juste pour un compteur.
// Ne compte que les avis non archives -- archiver un avis sert justement a
// le retirer du badge une fois traite.
export async function getFeedbackCountAction(): Promise<number> {
  const user = await requireUser();
  if (!isAdminEmail(user.email)) return 0;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(feedback)
    .where(eq(feedback.archived, false));
  return count;
}

export async function setFeedbackArchivedAction(id: number, archived: boolean) {
  await requireAdmin();
  await db.update(feedback).set({ archived }).where(eq(feedback.id, id));
  revalidatePath("/admin/feedback");
  revalidatePath("/");
}

export async function deleteFeedbackAction(id: number) {
  await requireAdmin();
  await db.delete(feedback).where(eq(feedback.id, id));
  revalidatePath("/admin/feedback");
  revalidatePath("/");
}
