import { requireUser } from "@/lib/session";
import { getBrandCatalog } from "@/lib/perfumes";
import { BrandCatalogView } from "@/components/brand-catalog-view";

export default async function BrandPage({ params }: { params: Promise<{ brand: string }> }) {
  await requireUser();
  const { brand: encoded } = await params;
  const brand = decodeURIComponent(encoded);
  const perfumes = await getBrandCatalog(brand);

  return <BrandCatalogView brand={brand} perfumes={perfumes} />;
}
