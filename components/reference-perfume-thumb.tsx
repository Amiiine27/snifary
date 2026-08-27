"use client";

import { useState } from "react";
import Image from "next/image";
import { Droplet } from "lucide-react";
import { cn } from "@/lib/utils";

// Vignette partagee par toutes les cartes de ReferencePerfume (Decouvrir,
// pages marque, "Vous pourriez aimer", fiche ReferencePerfumeSheet) --
// `imageUrl` vient de fimgsImageUrl (construite, jamais verifiee cote
// affichage, voir lib/perfumes.ts), donc le rare cas d'ID sans image se gere
// ici via onError plutot que de faire un aller-retour reseau par carte.
export function ReferencePerfumeThumb({
  imageUrl,
  name,
  className,
  iconClassName = "size-6",
  sizes = "150px",
}: {
  imageUrl: string | null;
  name: string;
  className?: string;
  iconClassName?: string;
  sizes?: string;
}) {
  const [errored, setErrored] = useState(false);
  const showImage = imageUrl && !errored;

  return (
    <div className={cn("relative overflow-hidden rounded-md bg-muted", className)}>
      {showImage ? (
        <Image
          src={imageUrl}
          alt={name}
          fill
          sizes={sizes}
          className="object-contain p-1"
          onError={() => setErrored(true)}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <Droplet className={iconClassName} />
        </div>
      )}
    </div>
  );
}
