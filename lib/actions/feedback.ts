"use server";

import { db } from "@/db";
import { feedback } from "@/db/schema";
import { requireUser } from "@/lib/session";

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
