// Format partage pour les listes de notes olfactives stockees en texte
// separe par des virgules (fragrantica_reference, ManualForm) -- utilise
// aussi bien cote lecture (lib/perfumes.ts) que cote ecriture (lib/actions/perfumes.ts).
export function splitNotesList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}
