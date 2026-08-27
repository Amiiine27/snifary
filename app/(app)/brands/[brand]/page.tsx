import { requireUser } from "@/lib/session";
import { getBrandCatalog, listWishlists } from "@/lib/perfumes";
import { BrandCatalogView } from "@/components/brand-catalog-view";

export default async function BrandPage({ params }: { params: Promise<{ brand: string }> }) {
  const user = await requireUser();
  const { brand: encoded } = await params;
  const brand = decodeURIComponent(encoded);

  const [perfumes, wishlistRows] = await Promise.all([getBrandCatalog(brand), listWishlists(user.id)]);
  const wishlists = wishlistRows.map((w) => ({ id: w.id, name: w.name }));

  return <BrandCatalogView brand={brand} perfumes={perfumes} wishlists={wishlists} />;
}
