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

  return (
    <div className="flex flex-col gap-8 px-4 pb-6">
      <DiscoverSection perfumes={discoverPerfumes} />

      {sections.map((section) => (
        <SectionPreview
          key={section.kind === "collection" ? "collection" : `wishlist-${section.id}`}
          title={section.name}
          href={sectionHref(section)}
          perfumes={section.items.map((i) => i.perfume)}
        />
      ))}

      <NewWishlistButton />
    </div>
  );
}
