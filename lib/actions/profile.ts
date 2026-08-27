"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import { uploadAvatarFromBuffer } from "@/lib/cloudinary";

export async function updateProfileNameAction(name: string) {
  await requireUser();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom d'utilisateur est requis");

  await auth.api.updateUser({ headers: await headers(), body: { name: trimmed } });
  revalidatePath("/profile");
}

export async function uploadAvatarAction(file: File) {
  await requireUser();
  if (!file.type.startsWith("image/")) throw new Error("Le fichier doit etre une image");

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadAvatarFromBuffer(buffer);

  await auth.api.updateUser({ headers: await headers(), body: { image: url } });
  revalidatePath("/profile");
}

export async function deleteAvatarAction() {
  await requireUser();
  await auth.api.updateUser({ headers: await headers(), body: { image: null } });
  revalidatePath("/profile");
}
