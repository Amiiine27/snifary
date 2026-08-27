import "server-only";

// ---------------------------------------------------------------------------
// Wikipedia comme filet de secours pour l'image ET la description d'un
// parfum, uniquement quand la fiche n'en a pas deja une (dataset Fragrantica
// local -> jamais d'image ni de description, voir db/schema.ts
// fragrantica_reference -- ce dataset n'a que nom/marque/genre/notes). API
// publique de MediaWiki, prevue pour un usage programmatique (contrairement
// au scraping Fragrantica) -- aucun souci de ToS/robots.txt ici.
//
// Volontairement TRES conservateur : un premier essai avec des variantes de
// titre plus larges ("{brand} {name}", nom seul) a produit plusieurs faux
// positifs verifies manuellement -- "Dior Sauvage" redirige vers l'article
// "Eau Sauvage" (un AUTRE parfum Dior, plus ancien), "Y" tombe sur l'article
// de la lettre de l'alphabet, "L'Interdit" a pour image une photo d'Audrey
// Hepburn (le parfum lui rend hommage) plutot qu'un flacon. Ne rien trouver
// est prefere a trouver une fausse info -- donc uniquement le titre exact
// `"{name} (perfume)"` (convention de desambiguisation Wikipedia), sans
// suivre de redirection, et seulement si la page est bien categorisee comme
// un parfum/une fragrance. Meme regle pour la description : pas de resume
// Fragrantica utilise ici (celui expose par leur widget/microdonnees n'est
// qu'un gabarit auto-genere qui repete les notes deja affichees par
// ailleurs -- aucune valeur ajoutee, verifie sur plusieurs fiches).
// ---------------------------------------------------------------------------

const WIKI_API = "https://en.wikipedia.org/w/api.php";
// Wikipedia demande un User-Agent identifiable (politique de l'API MediaWiki) :
// https://meta.wikimedia.org/wiki/User-Agent_policy
const USER_AGENT = "Snifary/1.0 (personal perfume-collection app; https://snifary.vercel.app)";
const FETCH_TIMEOUT_MS = 6000;
const FRAGRANCE_CATEGORY = /perfume|fragrance|cologne/i;
const MAX_DESCRIPTION_LENGTH = 600;

export type WikipediaPerfumeInfo = {
  image: string | null;
  description: string | null;
};

type PageResponse = {
  query?: {
    redirects?: unknown[];
    pages?: Record<
      string,
      {
        missing?: boolean;
        extract?: string;
        original?: { source: string };
        categories?: { title: string }[];
      }
    >;
  };
};

function truncateDescription(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_DESCRIPTION_LENGTH) return trimmed;
  const cut = trimmed.slice(0, MAX_DESCRIPTION_LENGTH);
  const lastSentenceEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"));
  return (lastSentenceEnd > 100 ? cut.slice(0, lastSentenceEnd + 1) : cut).trim();
}

export async function findWikipediaPerfumeInfo(name: string): Promise<WikipediaPerfumeInfo> {
  const empty: WikipediaPerfumeInfo = { image: null, description: null };
  const title = `${name} (perfume)`;

  try {
    const url = new URL(WIKI_API);
    url.searchParams.set("action", "query");
    url.searchParams.set("titles", title);
    // Pas de suivi de redirection : une redirection signifie generalement
    // que la page cible parle d'un AUTRE parfum (voir note ci-dessus).
    url.searchParams.set("prop", "pageimages|categories|extracts");
    url.searchParams.set("cllimit", "50");
    url.searchParams.set("piprop", "original");
    url.searchParams.set("exintro", "1");
    url.searchParams.set("explaintext", "1");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return empty;

    const json: PageResponse = await res.json();
    if (json.query?.redirects) return empty;

    const page = Object.values(json.query?.pages ?? {})[0];
    if (!page || page.missing) return empty;

    const isFragranceArticle = (page.categories ?? []).some((c) => FRAGRANCE_CATEGORY.test(c.title));
    if (!isFragranceArticle) return empty;

    const src = page.original?.source;
    // Ne garder que les images hebergees sur Wikimedia Commons : les images
    // locales a en.wikipedia.org (ex. /wikipedia/en/...) sont le plus souvent
    // des logos/captures en usage "fair use", restreintes a leur article
    // d'origine par la politique de contenu non-libre de Wikipedia.
    const image = src && src.includes("/wikipedia/commons/") ? src : null;

    const description = page.extract && page.extract.trim() ? truncateDescription(page.extract) : null;

    return { image, description };
  } catch {
    return empty;
  }
}
