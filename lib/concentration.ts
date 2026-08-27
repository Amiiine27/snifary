// Concentration jamais exposee de facon structuree ni par le dataset local ni
// par le scraping Fragrantica (voir PROJECT.md) -- mais elle apparait souvent
// en toutes lettres dans le nom lui-meme ("Sauvage Eau de Parfum"), d'ou ce
// best-effort plutot que de laisser systematiquement "Non renseigne". Partage
// entre le composant d'ajout (client) et les Server Actions qui font un ajout
// direct sans passer par ce composant (Decouvrir, page marque).
export type Concentration = "edt" | "edp" | "parfum" | "extrait" | "cologne" | null;

export function guessConcentration(name: string): Concentration {
  const n = name.toLowerCase();
  if (n.includes("eau de toilette")) return "edt";
  if (n.includes("eau de parfum")) return "edp";
  if (n.includes("extrait")) return "extrait";
  if (n.includes("elixir")) return "parfum";
  if (n.includes("cologne")) return "cologne";
  if (n.includes("parfum")) return "parfum";
  return null;
}
