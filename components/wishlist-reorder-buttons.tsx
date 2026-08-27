"use client";

import { useTransition } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { moveWishlistAction } from "@/lib/actions/wishlists";
import { cn } from "@/lib/utils";

// Fleches haut/bas sur chaque wishlist de l'accueil (jamais sur la
// collection, toujours en tete). En dehors du <Link> de SectionPreview --
// des boutons imbriques dans un <a> seraient invalides -- donc a cote, pas
// dedans.
export function WishlistReorderButtons({
  wishlistId,
  canMoveUp,
  canMoveDown,
}: {
  wishlistId: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    startTransition(async () => {
      await moveWishlistAction(wishlistId, direction);
    });
  }

  return (
    <div className="flex shrink-0 gap-0.5">
      <button
        onClick={() => move("up")}
        disabled={pending || !canMoveUp}
        aria-label="Monter la wishlist"
        className={cn("rounded p-1 text-muted-foreground disabled:opacity-30", canMoveUp && "hover:text-foreground")}
      >
        <ChevronUp className="size-4" />
      </button>
      <button
        onClick={() => move("down")}
        disabled={pending || !canMoveDown}
        aria-label="Descendre la wishlist"
        className={cn("rounded p-1 text-muted-foreground disabled:opacity-30", canMoveDown && "hover:text-foreground")}
      >
        <ChevronDown className="size-4" />
      </button>
    </div>
  );
}
