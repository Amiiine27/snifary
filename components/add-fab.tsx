"use client";

import { useState } from "react";
import { Plus, X, Droplet, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddPerfumeDialog } from "@/components/add-perfume-dialog";
import { NewWishlistDialog } from "@/components/new-wishlist-button";
import { cn } from "@/lib/utils";

type Target = { kind: "collection" } | { kind: "wishlist"; wishlistId: number };

// Le "+" se deploie toujours en 2 options (ajouter un parfum / creer une
// nouvelle wishlist), collection comprise -- redemande explicitement apres
// une premiere version qui limitait la collection a un bouton direct
// (ajout de parfum uniquement, pas de menu).
export function AddFab({ target }: { target: Target }) {
  return <ExpandableAddFab target={target} />;
}

// FAB qui se deploie en 2 options : ajouter un parfum a la section courante
// (collection ou wishlist), ou creer une toute nouvelle wishlist sans
// quitter la page.
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
