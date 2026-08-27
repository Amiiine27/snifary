"use client";

import { useState } from "react";
import { Plus, X, Droplet, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddPerfumeDialog } from "@/components/add-perfume-dialog";
import { NewWishlistDialog } from "@/components/new-wishlist-button";
import { cn } from "@/lib/utils";

type Target = { kind: "collection" } | { kind: "wishlist"; wishlistId: number };

// Dans la collection, le "+" n'a qu'un seul sens possible (ajouter un
// parfum) : bouton direct, pas de menu. Le choix "parfum vs nouvelle
// wishlist" n'a de sens que depuis une wishlist.
export function AddFab({ target }: { target: Target }) {
  if (target.kind === "collection") {
    return <SimpleAddFab target={target} />;
  }
  return <ExpandableAddFab target={target} />;
}

function SimpleAddFab({ target }: { target: Target }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Bande fixe pleine largeur contenant une colonne bornee a la meme
          largeur que le shell (voir app/(app)/layout.tsx) : sur tablette/PC,
          le shell s'elargit mais reste centre, donc le FAB doit suivre son
          bord droit plutot que celui du viewport (`right-4` seul collerait
          le bouton loin du contenu sur un grand ecran). */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center">
        <div className="flex w-full max-w-md justify-end px-4 sm:max-w-2xl lg:max-w-4xl">
          <Button
            className="pointer-events-auto size-16 rounded-full shadow-lg [&_svg:not([class*='size-'])]:size-7"
            onClick={() => setOpen(true)}
            aria-label="Ajouter un parfum"
          >
            <Plus />
          </Button>
        </div>
      </div>
      <AddPerfumeDialog target={target} open={open} onOpenChange={setOpen} />
    </>
  );
}

// FAB qui se deploie en 2 options : ajouter un parfum a la wishlist
// courante, ou creer une toute nouvelle wishlist sans quitter la page.
function ExpandableAddFab({ target }: { target: Target }) {
  const [expanded, setExpanded] = useState(false);
  const [showAddPerfume, setShowAddPerfume] = useState(false);
  const [showNewWishlist, setShowNewWishlist] = useState(false);

  return (
    <>
      {expanded && (
        <button
          aria-label="Fermer"
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-20"
        />
      )}

      {/* Meme technique que SimpleAddFab : bande fixe pleine largeur, colonne
          bornee a la largeur du shell, bouton (et ses options) ancres a son
          bord droit plutot qu'a celui du viewport. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center">
        <div className="flex w-full max-w-md flex-col items-end gap-3 px-4 sm:max-w-2xl lg:max-w-4xl">
          <div
            className={cn(
              "pointer-events-auto flex flex-col items-end gap-3 transition-all duration-150",
              expanded ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
            )}
          >
            <FabOption
              label="Nouvelle wishlist"
              icon={ListPlus}
              onClick={() => {
                setExpanded(false);
                setShowNewWishlist(true);
              }}
            />
            <FabOption
              label="Ajouter un parfum"
              icon={Droplet}
              onClick={() => {
                setExpanded(false);
                setShowAddPerfume(true);
              }}
            />
          </div>

          <Button
            className="pointer-events-auto size-16 rounded-full shadow-lg [&_svg:not([class*='size-'])]:size-7"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Fermer" : "Ajouter"}
            aria-expanded={expanded}
          >
            {expanded ? <X /> : <Plus />}
          </Button>
        </div>
      </div>

      <AddPerfumeDialog target={target} open={showAddPerfume} onOpenChange={setShowAddPerfume} />
      <NewWishlistDialog open={showNewWishlist} onOpenChange={setShowNewWishlist} />
    </>
  );
}

function FabOption({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-full bg-popover py-2 pl-4 pr-2 text-sm font-medium shadow-lg ring-1 ring-foreground/10"
    >
      {label}
      <span className="flex size-9 items-center justify-center rounded-full bg-foreground text-background">
        <Icon className="size-4" />
      </span>
    </button>
  );
}
