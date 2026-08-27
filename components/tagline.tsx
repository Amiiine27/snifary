"use client";

import { useEffect, useState } from "react";
import { randomTagline } from "@/lib/taglines";

// Choisi cote client apres montage pour eviter un mismatch d'hydratation
// (le serveur ne peut pas connaitre le meme aleatoire que le client).
export function Tagline({ className }: { className?: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- aleatoire volontairement pioche post-montage, cote client uniquement
    setText(randomTagline());
  }, []);

  return <p className={className}>{text ?? " "}</p>;
}
