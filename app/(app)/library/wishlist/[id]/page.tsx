import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getLibrarySections, sectionHref } from "@/lib/library";
import { LibrarySectionView, type LibraryItem } from "@/components/library-section-view";

export default async function WishlistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wishlistId = Number(id);
  const user = await requireUser();
  const sections = await getLibrarySections(user.id);

  // Navigation prev/next limitee aux autres wishlists : la collection n'est
  // volontairement pas accessible depuis ici (cf retour utilisateur).
  const wishlists = sections.filter((s) => s.kind === "wishlist");
  const index = wishlists.findIndex((s) => s.id === wishlistId);
  if (index === -1) notFound();

  const section = wishlists[index];
  const items: LibraryItem[] = section.items.map((i) => ({
    itemId: i.itemId,
    perfume: i.perfume,
    personalNote: null,
  }));

  return (
    <LibrarySectionView
      title={section.name}
      items={items}
      target={{ kind: "wishlist", wishlistId }}
      prevHref={index > 0 ? sectionHref(wishlists[index - 1]) : null}
      nextHref={index + 1 < wishlists.length ? sectionHref(wishlists[index + 1]) : null}
    />
  );
}
