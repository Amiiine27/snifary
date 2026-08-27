import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Droplet } from "lucide-react";
import type { PerfumeDetails } from "@/lib/perfumes";

export function SectionPreview({
  title,
  href,
  perfumes,
}: {
  title: string;
  href: string;
  perfumes: PerfumeDetails[];
}) {
  const preview = perfumes.slice(0, 6);

  return (
    <section className="flex flex-col gap-2.5">
      <Link href={href} className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>

      {preview.length === 0 ? (
        <Link
          href={href}
          className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground"
        >
          Rien ici pour l&apos;instant
        </Link>
      ) : (
        <Link href={href} className="grid grid-cols-3 gap-2.5">
          {preview.map((p) => (
            <div key={p.id} className="flex flex-col gap-1">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                {p.imageUrl ? (
                  <Image src={p.imageUrl} alt={p.name} fill sizes="150px" className="object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <Droplet className="size-6" />
                  </div>
                )}
              </div>
              <p className="line-clamp-1 text-xs font-medium">{p.brand}</p>
            </div>
          ))}
        </Link>
      )}
    </section>
  );
}
