import { requireUser } from "@/lib/session";
import { getDiscoverPerfumes, getUserGenderPreference, listWishlists } from "@/lib/perfumes";
import { DiscoverPageView } from "@/components/discover-page-view";

export default async function DiscoverPage() {
  const user = await requireUser();
  const [genderPreference, wishlistRows] = await Promise.all([
    getUserGenderPreference(user.id),
    listWishlists(user.id),
  ]);
  const perfumes = await getDiscoverPerfumes(user.id, genderPreference, 30);
  const wishlists = wishlistRows.map((w) => ({ id: w.id, name: w.name }));

  return <DiscoverPageView initialPerfumes={perfumes} wishlists={wishlists} />;
}
