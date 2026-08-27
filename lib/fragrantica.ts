import * as cheerio from "cheerio";

// ---------------------------------------------------------------------------
// Scraping Fragrantica, uniquement a la demande, jamais en masse (voir
// roadmap.md section 5). Deux etapes :
//   1. resoudre un nom tape par l'utilisateur vers une ou plusieurs fiches
//      Fragrantica candidates (searchFragrantica)
//   2. extraire les infos d'une fiche choisie (scrapeFragranticaPerfume)
//
// Fragrantica sert sa page de recherche cote client (Algolia + JS), donc un
// fetch serveur simple (cheerio, pas de navigateur headless) n'y voit aucun
// resultat. On resout donc le nom via la recherche HTML de DuckDuckGo
// (site:fragrantica.com ...), qui elle est du HTML statique, puis on scrape
// directement la fiche Fragrantica trouvee (celle-ci est bien du HTML
// serveur, avec microdonnees schema.org - cf notes de session).
// ---------------------------------------------------------------------------

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

// DuckDuckGo/Fragrantica peuvent etre lents ou bloquer un serveur (IP
// datacenter Vercel) sans jamais repondre : on borne chaque requete pour
// echouer proprement plutot que de bloquer indefiniment la recherche.
const FETCH_TIMEOUT_MS = 6000;

function fetchWithTimeout(url: string | URL) {
  return fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

export type FragranticaCandidate = {
  url: string;
  title: string;
};

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

export async function searchFragrantica(query: string): Promise<FragranticaCandidate[]> {
  const searchUrl = new URL("https://html.duckduckgo.com/html/");
  searchUrl.searchParams.set("q", `site:fragrantica.com/perfume ${query}`);

  const res = await fetchWithTimeout(searchUrl);
  if (!res.ok) throw new Error(`Recherche echouee (${res.status})`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const seen = new Set<string>();
  const candidates: FragranticaCandidate[] = [];

  $("a.result__a").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const url = extractRealUrl(href);
    if (!url || !url.includes("fragrantica.com/perfume/") || seen.has(url)) return;
    seen.add(url);
    candidates.push({ url, title: $(el).text().trim() });
  });

  return candidates.slice(0, 8);
}

// DuckDuckGo renvoie les liens via une redirection `//duckduckgo.com/l/?uddg=<url encodee>`
function extractRealUrl(href: string): string | null {
  try {
    const asUrl = new URL(href, "https://duckduckgo.com");
    const uddg = asUrl.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : asUrl.toString();
  } catch {
    return null;
  }
}

export async function scrapeFragranticaPerfume(fragranticaUrl: string): Promise<ScrapedPerfume> {
  const res = await fetchWithTimeout(fragranticaUrl);
  if (!res.ok) throw new Error(`Fiche introuvable (${res.status})`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const brand = $('p[itemprop="brand"] span[itemprop="name"]').first().text().trim();

  const h1 = $("h1[itemprop='name']").first().clone();
  const genderText = h1.find("span").first().text().trim().toLowerCase();
  h1.find("span").remove();
  let name = h1.text().replace(/\s+/g, " ").trim();
  if (brand && name.endsWith(brand)) {
    name = name.slice(0, name.length - brand.length).trim();
  }

  // "for women" contient litteralement "men" (wo-MEN) : un simple double
  // includes() classait donc TOUTE fiche femme en unisexe. Fragrantica
  // n'emploie que 3 formulations ("for men", "for women", "for women and
  // men"), la conjonction "and" est le seul signal fiable du cas mixte.
  const hasWomen = genderText.includes("women");
  const hasMen = /\bmen\b/.test(genderText);
  const gender: ScrapedPerfume["gender"] = genderText.includes("and")
    ? "unisexe"
    : hasWomen
      ? "femme"
      : hasMen
        ? "homme"
        : "unisexe";

  const imageUrl = $('img[itemprop="image"]').first().attr("src") ?? null;

  const readLevel = (level: "top" | "middle" | "base") =>
    $(`pyramid-level-new[notes="${level}"] .pyramid-note-label`)
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);

  return {
    name,
    brand,
    gender,
    imageUrl,
    fragranticaUrl,
    notes: {
      top: readLevel("top"),
      heart: readLevel("middle"),
      base: readLevel("base"),
    },
  };
}
