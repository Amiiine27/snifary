"use server";

import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { feedback } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";

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
  const user = await requireUser();
  if (!isAdminEmail(user.email)) throw new Error("Non autorise");

  return db.select().from(feedback).orderBy(desc(feedback.createdAt));
}

// Requete legere dediee au badge de la cloche (AppTopBar, rendu sur chaque
// page) : pas besoin de rapatrier toutes les lignes juste pour un compteur.
export async function getFeedbackCountAction(): Promise<number> {
  const user = await requireUser();
  if (!isAdminEmail(user.email)) return 0;

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(feedback);
  return count;
}
