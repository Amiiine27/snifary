import { Skeleton } from "@/components/ui/skeleton";

// Un seul skeleton pour tout le groupe (app) : Next.js l'affiche
// immediatement pendant qu'une page (home, collection, wishlist, profil...)
// va chercher ses donnees sur Turso, pour que le changement de page ne
// paraisse jamais fige/lateux.
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-5 px-4 pt-8">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    </div>
  );
}
