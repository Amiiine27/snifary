"use client";

import Image from "next/image";
import { Droplet } from "lucide-react";
import type { PerfumeCard as PerfumeCardData } from "@/lib/perfumes";
import { cn } from "@/lib/utils";

export function PerfumeCard({
  perfume,
  view,
  onClick,
}: {
  perfume: PerfumeCardData;
  view: "grid" | "list";
  onClick: () => void;
}) {
  if (view === "list") {
    return (
      <button
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-lg border border-border p-2 text-left transition-colors hover:bg-muted"
      >
        <Thumb imageUrl={perfume.imageUrl} name={perfume.name} className="size-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{perfume.name}</p>
          <p className="truncate text-xs text-muted-foreground">{perfume.brand}</p>
        </div>
        <PriceTag perfume={perfume} />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-1.5 rounded-lg border border-border p-2 text-left transition-colors hover:bg-muted"
    >
      <Thumb imageUrl={perfume.imageUrl} name={perfume.name} className="aspect-square w-full" />
      <p className="line-clamp-2 w-full text-xs font-medium leading-tight">{perfume.name}</p>
      <PriceTag perfume={perfume} className="text-[11px]" />
    </button>
  );
}

function Thumb({
  imageUrl,
  name,
  className,
}: {
  imageUrl: string | null;
  name: string;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-muted", className)}>
      {imageUrl ? (
        <Image src={imageUrl} alt={name} fill sizes="200px" className="object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <Droplet className="size-6" />
        </div>
      )}
    </div>
  );
}

function PriceTag({ perfume, className }: { perfume: PerfumeCardData; className?: string }) {
  if (perfume.price == null) return null;
  return (
    <span className={cn("text-muted-foreground", className)}>
      {perfume.price}&nbsp;&euro; / {perfume.volumeMl}&nbsp;mL
    </span>
  );
}
