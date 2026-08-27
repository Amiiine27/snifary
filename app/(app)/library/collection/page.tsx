import { requireUser } from "@/lib/session";
import { getLibrarySections, sectionHref } from "@/lib/library";
import { LibrarySectionView, type LibraryItem } from "@/components/library-section-view";

export default async function CollectionPage() {
  const user = await requireUser();
  const sections = await getLibrarySections(user.id);
  const collection = sections[0];

  const items: LibraryItem[] =
    collection.kind === "collection"
      ? collection.items.map((i) => ({ itemId: i.itemId, perfume: i.perfume, personalNote: i.personalNote }))
      : [];

  const wishlists = sections.filter((s) => s.kind === "wishlist").map((s) => ({ id: s.id, name: s.name }));

  return (
    <LibrarySectionView
      title={collection.name}
      items={items}
      target={{ kind: "collection" }}
      prevHref={null}
      nextHref={sections.length > 1 ? sectionHref(sections[1]) : null}
      wishlists={wishlists}
    />
  );
}
