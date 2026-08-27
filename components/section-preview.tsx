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
    <section className="flex flex-col gap-3">
      <Link href={href} className="flex items-center justify-between">
        <h2 className="font-heading text-xl">{title}</h2>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>

      {preview.length === 0 ? (
        <Link
          href={href}
          className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground"
        >
          Rien ici pour l&apos;instant
        </Link>
      ) : (
        <Link href={href} className="grid grid-cols-3 gap-3">
          {preview.map((p) => (
            <div key={p.id} className="flex flex-col gap-1.5">
              <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                {p.imageUrl ? (
                  <Image src={p.imageUrl} alt={p.name} fill sizes="150px" className="object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <Droplet className="size-7" />
                  </div>
                )}
              </div>
              <p className="line-clamp-1 text-sm font-medium">{p.brand}</p>
            </div>
          ))}
        </Link>
      )}
    </section>
  );
}
