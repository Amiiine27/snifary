import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getLibrarySections, sectionHref } from "@/lib/library";

// Point d'entree du bouton "coeur" de la nav : redirige vers la premiere
// wishlist, ou vers la collection s'il n'y en a encore aucune.
export default async function WishlistsEntryPage() {
  const user = await requireUser();
  const sections = await getLibrarySections(user.id);
  const firstWishlist = sections.find((s) => s.kind === "wishlist");
  redirect(firstWishlist ? sectionHref(firstWishlist) : "/library/collection");
}
