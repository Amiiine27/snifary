import { requireUser } from "@/lib/session";
import { getLibrarySections, sectionHref } from "@/lib/library";
import { SectionPreview } from "@/components/section-preview";
import { NewWishlistButton } from "@/components/new-wishlist-button";
import { Tagline } from "@/components/tagline";

export default async function HomePage() {
  const user = await requireUser();
  const sections = await getLibrarySections(user.id);

  return (
    <div className="flex flex-col gap-8 px-4 pb-6 pt-2">
      <Tagline className="text-center text-base text-muted-foreground" />

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
