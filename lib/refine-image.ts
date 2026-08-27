import { removeImageBackground } from "@/lib/remove-background";
import { uploadPerfumeImageAction, updatePerfumeImageAction } from "@/lib/actions/perfumes";

// Ameliore en arriere-plan l'image d'un parfum tout juste ajoute
// automatiquement (fimgs.net, Open Beauty Facts ou Wikipedia) en lui
// retirant son fond -- ces trois sources ne passent jamais par
// removeImageBackground cote serveur (fetch cross-origin fragile depuis le
// navigateur pour une image tierce, cf PROJECT.md), donc l'image arrive sur
// fond blanc/uni. Corrige ici, une fois l'image deja sur Cloudinary : lui,
// contrairement a fimgs.net, autorise le CORS (`Access-Control-Allow-Origin:
// *`), donc le navigateur peut retelecharger l'image et la repasser dans le
// meme pipeline WASM que ManualForm. Best-effort et jamais bloquant :
// appelee sans attendre (fire-and-forget) juste apres l'ajout, l'image
// "pop" en fond transparent quelques secondes plus tard ; un echec ne
// remonte nulle part, l'image d'origine (fond inclus) reste simplement en
// place.
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
