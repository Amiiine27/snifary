import "server-only";
import { listCollection, listWishlists } from "@/lib/perfumes";

export type LibrarySection =
  | { kind: "collection"; name: string; items: Awaited<ReturnType<typeof listCollection>> }
  | {
      kind: "wishlist";
      id: number;
      name: string;
      items: Awaited<ReturnType<typeof listWishlists>>[number]["items"];
    };

// Ordre affiche partout dans l'app : la collection possedee d'abord, puis
// chaque wishlist dans l'ordre choisi par l'utilisateur (`position`).
export async function getLibrarySections(userId: string): Promise<LibrarySection[]> {
  const [collection, wishlists] = await Promise.all([listCollection(userId), listWishlists(userId)]);

  return [
    { kind: "collection", name: "Ma collection", items: collection },
    ...wishlists.map((w) => ({
      kind: "wishlist" as const,
      id: w.id,
      name: w.name,
      items: w.items,
    })),
  ];
}

export function sectionHref(section: LibrarySection): string {
  return section.kind === "collection" ? "/library/collection" : `/library/wishlist/${section.id}`;
}
