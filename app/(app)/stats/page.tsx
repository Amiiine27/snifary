import { requireUser } from "@/lib/session";
import { getLibrarySections, sectionHref } from "@/lib/library";
import { LibrarySectionView, type LibraryItem } from "@/components/library-section-view";

export default async function StatsPage() {
  const user = await requireUser();
  const sections = await getLibrarySections(user.id);

  const collection = sections.find((s) => s.kind === "collection");
  const wishlists = sections.filter((s) => s.kind === "wishlist");

  const owned = collection?.items.map((i) => i.perfume) ?? [];
  const totalSpent = owned.reduce((sum, p) => sum + (p.price ?? 0), 0);

  const collectionItems: LibraryItem[] =
    collection && collection.kind === "collection"
      ? collection.items.map((i) => ({ itemId: i.itemId, perfume: i.perfume, personalNote: i.personalNote }))
      : [];

  return (
    <LibrarySectionView
      title="Ma collection"
      aside={
        <span>
          {owned.length} parfum{owned.length > 1 ? "s" : ""} possede{owned.length > 1 ? "s" : ""} · {totalSpent.toFixed(0)}&nbsp;€ depenses
        </span>
      }
      items={collectionItems}
      target={{ kind: "collection" }}
      prevHref={null}
      nextHref={wishlists.length > 0 ? sectionHref(wishlists[0]) : null}
    />
  );
}
