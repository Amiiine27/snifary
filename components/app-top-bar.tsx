import { ThemeToggleButton } from "@/components/theme-toggle";

// Barre persistante, comme BottomNav mais en haut : le logo Snifary reste
// visible sur TOUTES les pages de l'app (home, collection, wishlists,
// stats, profil, feedback), jamais seulement sur certaines.
export function AppTopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-popover/95 backdrop-blur supports-backdrop-filter:bg-popover/80">
      <div className="mx-auto grid max-w-md grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 px-3 py-2.5">
        <div />
        <h1 className="text-center font-heading text-xl">Snifary</h1>
        <ThemeToggleButton />
      </div>
    </header>
  );
}
