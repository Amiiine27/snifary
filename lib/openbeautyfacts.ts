import "server-only";

// ---------------------------------------------------------------------------
// Open Beauty Facts (openbeautyfacts.org) comme source d'image pour un
// parfum -- base ouverte et collaborative (soeur d'Open Food Facts, meme
// licence Open Database License), API publique explicitement prevue pour un
// usage programmatique. Aucun souci de ToS/robots.txt ici, contrairement a
// Fragrantica/Sephora. Pas de champ description exploitable ici (verifie :
// generic_name/ingredients_text vides sur les parfums) -- uniquement une
// source d'image, la description reste Wikipedia seul (lib/wikipedia.ts).
//
// Couverture testee manuellement : solide sur les grosses marques (Dior,
// Chanel, Armani, YSL, Givenchy, JPG, Guerlain, Versace, Hugo Boss, Calvin
// Klein, Burberry...), quasi vide pour certaines (Prada: 0 resultat) et pour
// la longue traine du dataset local (~24k parfums, essentiellement une base
// "scan de code-barres en rayon" donc plus faible sur le niche/vintage).
//
// Donnees tres heterogenes (multilingue, volumes/mentions marketing dans le
// nom : "Emporio Armani Stronger With You Intensely Eau de Parfum Erkek
// Parfumu") -- matching strict plutot qu'un score approximatif, sur le meme
// principe de prudence que lib/wikipedia.ts : mieux vaut ne rien trouver que
// d'attribuer la mauvaise image. Deux regles :
//   1. Tous les mots significatifs du nom recherche doivent apparaitre dans
//      le nom du produit candidat (le candidat peut avoir des mots EN PLUS --
//      bruit de fiche retail comme "Pour Homme Refillable" -- mais pas EN
//      MOINS).
//   2. Le candidat ne doit contenir AUCUN mot de la liste `VARIANT_MARKERS`
//      qui ne soit pas deja dans le nom recherche. Sans ce garde-fou,
//      chercher "Stronger With You" remontait la photo de "Stronger With
//      You INTENSELY" (un flanker different) -- verifie manuellement, faux
//      positif net.
// ---------------------------------------------------------------------------

const OBF_API = "https://world.openbeautyfacts.org/api/v2/search";
// Open Beauty Facts documente et recommande un User-Agent identifiable.
const USER_AGENT = "Snifary/1.0 (personal perfume-collection app; https://snifary.vercel.app)";
const FETCH_TIMEOUT_MS = 6000;

const STOP_WORDS = new Set([
  "de", "du", "la", "le", "les", "eau", "and", "for", "the", "a", "au",
  "parfum", "parfums", "toilette", "cologne", "edp", "edt", "ml",
  "pour", "homme", "femme", "men", "women", "man", "woman",
]);

// Mots qui signalent un flanker/une variante specifique -- s'ils apparaissent
// chez le candidat sans etre demandes, c'est presque toujours un AUTRE
// parfum de la meme ligne, pas une reformulation cosmetique de la fiche.
const VARIANT_MARKERS = new Set([
  "intense", "intensely", "extreme", "elixir", "absolu", "sport", "fraiche",
  "legend", "night", "gold", "platinum", "ultra", "noir", "black",
  "collector", "limited", "edition", "privee", "reserve", "concentree",
]);

function significantTokens(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t) && !/^\d+$/.test(t));
}

function slugifyBrand(brand: string): string {
  return brand
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type SearchResponse = {
  products?: { product_name?: string; image_url?: string }[];
};

export async function findOpenBeautyFactsImage(name: string, brand: string): Promise<string | null> {
  const nameTokens = significantTokens(name);
  const nameTokenSet = new Set(nameTokens);
  if (nameTokens.length === 0) return null;

  try {
    const url = new URL(OBF_API);
    url.searchParams.set("categories_tags", "perfumes");
    url.searchParams.set("brands_tags", slugifyBrand(brand));
    url.searchParams.set("fields", "product_name,image_url");
    url.searchParams.set("page_size", "100");

    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const json: SearchResponse = await res.json();
    // Parmi les candidats valides, on prefere celui dont le nom est le plus
    // proche (le moins de bruit en plus) -- meilleur indice de non-ambiguite.
    let best: { url: string; noiseRatio: number } | null = null;

    for (const product of json.products ?? []) {
      if (!product.image_url || !product.product_name) continue;

      const candidateTokens = significantTokens(product.product_name);
      const candidateSet = new Set(candidateTokens);

      const allSourceTokensPresent = nameTokens.every((t) => candidateSet.has(t));
      if (!allSourceTokensPresent) continue;

      const hasUnwantedVariantMarker = candidateTokens.some(
        (t) => VARIANT_MARKERS.has(t) && !nameTokenSet.has(t)
      );
      if (hasUnwantedVariantMarker) continue;

      const noiseRatio = candidateTokens.length / nameTokens.length;
      if (!best || noiseRatio < best.noiseRatio) {
        best = { url: product.image_url, noiseRatio };
      }
    }

    return best?.url ?? null;
  } catch {
    return null;
  }
}
