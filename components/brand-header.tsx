import { ThemeToggleButton } from "@/components/theme-toggle";
import { Tagline } from "@/components/tagline";

// Logo "Snifary" centre sur la meme ligne que le bouton jour/nuit, utilise
// sur les pages d'identite (login, accueil, profil, feedback). Le spacer a
// gauche a la meme largeur que le bouton pour que le titre reste vraiment
// centre sur toute la largeur, pas juste entre le bord et le bouton.
export function BrandHeader({ tagline = false }: { tagline?: boolean }) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
      <div />
      <div className="text-center">
        <h1 className="font-heading text-3xl">Snifary</h1>
        {tagline && <Tagline className="mt-1 text-sm text-muted-foreground" />}
      </div>
      <ThemeToggleButton />
    </div>
  );
}
