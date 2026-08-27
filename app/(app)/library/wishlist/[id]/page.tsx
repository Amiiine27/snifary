import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getLibrarySections, sectionHref } from "@/lib/library";
import { LibrarySectionView, type LibraryItem } from "@/components/library-section-view";

export default async function WishlistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wishlistId = Number(id);
  const user = await requireUser();
  const sections = await getLibrarySections(user.id);

  const index = sections.findIndex((s) => s.kind === "wishlist" && s.id === wishlistId);
  if (index === -1) notFound();

  const section = sections[index];
  const items: LibraryItem[] =
    section.kind === "wishlist"
      ? section.items.map((i) => ({ itemId: i.itemId, perfume: i.perfume, personalNote: null }))
      : [];

  return (
    <LibrarySectionView
      title={section.name}
      items={items}
      target={{ kind: "wishlist", wishlistId }}
      prevHref={sectionHref(sections[index - 1])}
      nextHref={index + 1 < sections.length ? sectionHref(sections[index + 1]) : null}
    />
  );
}
