import { removeImageBackground } from "@/lib/remove-background";
import { uploadPerfumeImageAction, updatePerfumeImageAction } from "@/lib/actions/perfumes";

// Retire le fond de l'image d'un parfum tout juste ajoute automatiquement
// (fimgs.net, Open Beauty Facts ou Wikipedia) -- ces trois sources ne
// passent jamais par removeImageBackground cote serveur (fetch cross-origin
// fragile depuis le navigateur pour une image tierce, cf PROJECT.md), donc
// l'image arrive sur fond blanc/uni. Corrige ici, une fois l'image deja sur
// Cloudinary : lui, contrairement a fimgs.net, autorise le CORS
// (`Access-Control-Allow-Origin: *`), donc le navigateur peut retelecharger
// l'image et la repasser dans le meme pipeline WASM que ManualForm.
// **Appelee avec `await` par ses deux appelants** (pas fire-and-forget) :
// demande explicite pour ne jamais laisser voir la version fond blanc, quitte
// a attendre quelques secondes de plus avant de considerer l'ajout termine.
// Reste best-effort cote erreur : un echec (`catch`) ne remonte nulle part,
// l'image d'origine (fond inclus) reste simplement en place.
export async function refineNewPerfumeImage(perfumeId: number, imageUrl: string) {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return;
    const blob = await res.blob();

    const transparent = await removeImageBackground(new File([blob], "perfume.jpg", { type: blob.type }));
    const uploadFile = new File([transparent], "perfume.png", { type: transparent.type || "image/png" });

    const publicId = await uploadPerfumeImageAction(uploadFile);
    await updatePerfumeImageAction(perfumeId, publicId);
  } catch (err) {
    console.error("Suppression de fond post-ajout echouee :", err);
  }
}
