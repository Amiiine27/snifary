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
        <>
          <StatChip value={owned.length} label={`parfum${owned.length > 1 ? "s" : ""} possede${owned.length > 1 ? "s" : ""}`} />
          <StatChip value={`${totalSpent.toFixed(0)} €`} label="depenses" />
        </>
      }
      items={collectionItems}
      target={{ kind: "collection" }}
      prevHref={null}
      nextHref={wishlists.length > 0 ? sectionHref(wishlists[0]) : null}
      wishlists={wishlists.map((w) => ({ id: w.id, name: w.name }))}
    />
  );
}

function StatChip({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-full bg-muted px-3.5 py-2">
      <span className="text-lg font-semibold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
