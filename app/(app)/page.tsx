import { requireUser } from "@/lib/session";
import { getLibrarySections, sectionHref } from "@/lib/library";
import { getDiscoverPerfumes, getUserGenderPreference } from "@/lib/perfumes";
import { SectionPreview } from "@/components/section-preview";
import { DiscoverSection } from "@/components/discover-section";
import { NewWishlistButton } from "@/components/new-wishlist-button";

export default async function HomePage() {
  const user = await requireUser();
  const [sections, genderPreference] = await Promise.all([
    getLibrarySections(user.id),
    getUserGenderPreference(user.id),
  ]);
  const discoverPerfumes = await getDiscoverPerfumes(user.id, genderPreference);
  const wishlists = sections.filter((s) => s.kind === "wishlist").map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="flex flex-col gap-8 px-4 pb-6">
      <DiscoverSection perfumes={discoverPerfumes} wishlists={wishlists} />

      {sections.map((section) => {
        const wishlistIndex = section.kind === "wishlist" ? wishlists.findIndex((w) => w.id === section.id) : -1;
        return (
          <SectionPreview
            key={section.kind === "collection" ? "collection" : `wishlist-${section.id}`}
            title={section.name}
            href={sectionHref(section)}
            perfumes={section.items.map((i) => i.perfume)}
            reorder={
              section.kind === "wishlist"
                ? { wishlistId: section.id, canMoveUp: wishlistIndex > 0, canMoveDown: wishlistIndex < wishlists.length - 1 }
                : undefined
            }
          />
        );
      })}

      <NewWishlistButton />
    </div>
  );
}
