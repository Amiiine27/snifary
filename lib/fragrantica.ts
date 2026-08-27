// ---------------------------------------------------------------------------
// Le scraping HTML en direct de Fragrantica (recherche DuckDuckGo + fiche
// via cheerio) a ete retire : fragrantica.com sert desormais un vrai
// challenge Cloudflare JS (`Cf-Mitigated: challenge`) meme via curl/fetch
// serveur, et de toute facon le dataset local `fragrantica_reference`
// (~24k parfums) couvre deja nom/marque/genre/notes pour l'immense majorite
// des recherches -- voir resolvePerfumeAction/searchFragranticaCandidatesAction
// dans lib/actions/perfumes.ts. Seule fonction encore utile ici : recuperer
// l'image d'un parfum, qui elle vit sur un CDN separe non protege.
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 6000;

export type ScrapedPerfume = {
  name: string;
  brand: string;
  gender: "homme" | "femme" | "unisexe";
  imageUrl: string | null;
  fragranticaUrl: string;
  notes: {
    top: string[];
    heart: string[];
    base: string[];
  };
};

// Fragrantica sert ses images depuis un sous-domaine CDN separe (fimgs.net)
// qui n'est PAS derriere le meme challenge Cloudflare que le reste du site --
// verifie manuellement (curl, WebFetch, echantillon aleatoire de
// fragrantica_reference incluant des marques tres confidentielles) : 100% de
// reussite, vraies photos distinctes a chaque fois, et le robots.txt de ce
// sous-domaine n'interdit que le crawler de la Wayback Machine. Pattern
// simple : `o.<id>.jpg` (photo pleine resolution), ou <id> est le nombre en
// fin d'URL Fragrantica (ex. Sauvage-31861.html -> 31861) -- deja present sur
// toute ligne fragrantica_reference, sans requete reseau supplementaire pour
// l'obtenir.
export function fimgsImageUrl(fragranticaUrl: string): string | null {
  const match = fragranticaUrl.match(/-(\d+)\.html?$/);
  return match ? `https://fimgs.net/mdimg/perfume/o.${match[1]}.jpg` : null;
}

// Verifie que l'image existe reellement (HEAD, pas de telechargement du
// corps) avant de la traiter comme une source fiable pour un upload
// Cloudinary -- un ID sans image renvoie un 404 propre (teste), jamais un
// faux positif, mais autant confirmer avant de s'engager sur un upload qui
// echouerait sinon. Utilise uniquement au moment d'ecrire un parfum en base
// (voir findImageAndDescription) ; l'affichage cote UI (ReferencePerfume,
// toReferencePerfume dans lib/perfumes.ts) utilise fimgsImageUrl seule, sans
// verification, avec un repli visuel (onError) en cas d'echec rare.
export async function findFimgsImage(fragranticaUrl: string): Promise<string | null> {
  const url = fimgsImageUrl(fragranticaUrl);
  if (!url) return null;
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    return res.ok ? url : null;
  } catch {
    return null;
  }
}
