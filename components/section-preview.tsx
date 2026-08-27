import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Droplet } from "lucide-react";
import type { PerfumeDetails } from "@/lib/perfumes";
import { WishlistReorderButtons } from "@/components/wishlist-reorder-buttons";

export function SectionPreview({
  title,
  href,
  perfumes,
  reorder,
}: {
  title: string;
  href: string;
  perfumes: PerfumeDetails[];
  reorder?: { wishlistId: number; canMoveUp: boolean; canMoveDown: boolean };
}) {
  const preview = perfumes.slice(0, 4);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Link href={href} className="flex flex-1 items-center justify-between">
          <h2 className="font-heading text-xl">{title}</h2>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>
        {reorder && (
          <WishlistReorderButtons
            wishlistId={reorder.wishlistId}
            canMoveUp={reorder.canMoveUp}
            canMoveDown={reorder.canMoveDown}
          />
        )}
      </div>

      {preview.length === 0 ? (
        <Link
          href={href}
          className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground"
        >
          Rien ici pour l&apos;instant
        </Link>
      ) : (
        <Link href={href} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {preview.map((p) => (
            <div key={p.id} className="flex flex-col gap-1.5">
              <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                {p.imageUrl ? (
                  <Image src={p.imageUrl} alt={p.name} fill sizes="200px" className="object-contain p-2" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <Droplet className="size-7" />
                  </div>
                )}
              </div>
              <div>
                <p className="line-clamp-1 text-sm font-medium">{p.name}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="line-clamp-1">{p.brand}</span>
                  {p.price != null && <span className="shrink-0">{p.price}&nbsp;&euro;</span>}
                </div>
              </div>
            </div>
          ))}
        </Link>
      )}
    </section>
  );
}
