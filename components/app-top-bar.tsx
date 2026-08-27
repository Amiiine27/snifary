import { ThemeToggleButton } from "@/components/theme-toggle";
import { Tagline } from "@/components/tagline";

// Persistant sur toutes les pages (comme BottomNav mais en haut), mais sans
// bandeau : flotte directement sur le fond de la page, pas de barre coloree
// ni de ligne de separation.
export function AppTopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto grid max-w-md grid-cols-[2.5rem_1fr_2.5rem] items-start gap-2 px-3 pt-4">
        <div />
        <div className="text-center">
          <h1 className="font-heading text-xl">Snifary</h1>
          <Tagline className="mt-0.5 text-xs text-muted-foreground" />
        </div>
        <ThemeToggleButton />
      </div>
    </header>
  );
}
