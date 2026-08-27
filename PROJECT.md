# Snifary — contexte projet pour Claude

> **Ce fichier DOIT rester a jour.** Toute session Claude qui modifie une table,
> une route, un composant partage (bottom nav, top bar, dialogs de recherche),
> le flux d'auth, le scraping, ou une decision d'architecture doit mettre a
> jour la section correspondante ci-dessous **dans le meme tour de travail**,
> pas "plus tard". Ce fichier est charge automatiquement via `CLAUDE.md`
> (`@PROJECT.md`) au debut de chaque session : s'il ment, chaque session
> repart d'une comprehension fausse du projet. Mieux vaut un fichier plus
> court mais exact qu'un fichier exhaustif mais perime.

## Vue d'ensemble

Snifary = bibliotheque de parfums personnelle, multi-utilisateurs, mobile-first
(coque `max-w-md` centree, pensee pour etre installee comme une PWA sur
telephone). Chaque utilisateur gere : une **collection** (parfums possedes) et
plusieurs **wishlists** nommees (listes de souhaits). Les fiches parfum
(nom/marque/image/notes) viennent soit d'un scraping Fragrantica a la demande,
soit d'une saisie manuelle. Projet perso, echelle "quelques utilisateurs" —
toute decision doit rester simple (`roadmap.md` a la racine documente l'esprit
"zero over-engineering" d'origine, garde comme reference historique).

Repo : `github.com/Amiiine27/snifary` (branche `main`, deploiement Vercel
automatique a chaque push). Prod : `https://snifary.vercel.app`.

## Stack exacte

- Next.js 16 (App Router, Turbopack par defaut), React 19.2, TypeScript strict
- Tailwind v4 (CSS-first, `@theme inline` dans `app/globals.css`)
- shadcn/ui, preset **Nova** — composants bases sur `@base-ui/react` (PAS
  Radix). API similaire a Radix (open/onOpenChange, etc.) mais pas identique.
- Turso (libSQL, region `aws-eu-west-1`) + Drizzle ORM
- Better Auth 1.7.2 — Google uniquement, schema ecrit a la main (voir plus bas)
- Cloudinary (upload images)
- `@imgly/background-removal` (suppression de fond, 100% navigateur/WASM)
- `next-themes` (theme clair/sombre), `sonner` (toasts, position top-center)
- Police display : Google Font **Rowdies** (var `--font-rowdies`, mappee sur
  `font-heading`) ; corps de texte : Geist (var `--font-geist-sans`, mappee
  sur `font-sans`)
- Vercel Hobby, region fonctions pinnee sur `dub1` (vercel.json) — la plus
  proche de Turso `eu-west-1`, pour limiter la latence des requetes DB

**Next.js 16 a des breaking changes vs les habitudes pre-16** (voir
`AGENTS.md`, bloc auto-regenere par `next dev` — ne pas le supprimer/editer,
il revient tout seul). En resume ceux qui nous concernent : `params`,
`searchParams`, `cookies()`, `headers()` sont tous `Promise` a await ;
`middleware.ts` s'appelle desormais `proxy.ts` (export `proxy`, pas
`middleware`) ; `next/image` a des defaults `remotePatterns` stricts.

## Schema DB (`db/schema.ts` + `db/auth-schema.ts`)

Toutes les tables sont sur la meme base Turso. IDs `integer` autoincrement
partout (pas d'UUID — toute requete est filtree par `userId` de session de
toute facon). Enums = `text` + `CHECK` SQL natif (jamais un type TS seul —
protection meme en cas de bug applicatif). Cascade delete partout sur les FK
vers `user.id` et `perfumes.id`.

### Tables Better Auth (`db/auth-schema.ts`) — a la main, PAS via le CLI

Le CLI `@better-auth/cli` est deprecated cote npm avec des vulnerabilites
signalees (installe puis desinstalle dans cette session). Le schema est donc
recopie a la main depuis les sources de `better-auth`. **Piege deja rencontre** :
la table `account` a besoin d'un champ `issuer` (RFC 9207, cle d'unicite avec
`accountId`) que la version installee de better-auth exige au runtime — sans
lui, le callback Google plante en silence ("Better Auth was unable to query
your database ... field issuer does not exist"). Si on remonte encore une
version de better-auth, **revalider le schema attendu** via
`node_modules/@better-auth/core/src/db/get-tables.ts` avant de supposer que le
schema actuel suffit toujours.

- `user` : id (text, cuid), name, email (unique), emailVerified, image
  (URL complete ici, PAS un public_id Cloudinary — seule exception a la regle
  ci-dessous, car c'est aussi ce que Google y met directement), createdAt, updatedAt
- `session` : id, userId→user, token (unique), expiresAt, ipAddress, userAgent
- `account` : id, userId→user, **issuer** (default `""`, l'app renseigne
  toujours une vraie valeur), providerId, accountId, accessToken, refreshToken,
  idToken, accessTokenExpiresAt, refreshTokenExpiresAt, scope, password ;
  index unique `(issuer, accountId)`
- `verification` : id, identifier, value, expiresAt

### Tables metier (`db/schema.ts`)

- **`perfumes`** — catalogue **partage** entre tous les utilisateurs (cache du
  scraping/de la saisie manuelle), jamais duplique. id, name, brand,
  `imagePublicId` (Cloudinary public_id **uniquement**, jamais l'URL complete —
  portabilite future), `fragranticaUrl` (nullable — null pour une saisie
  manuelle), `inspiredBy` (nullable — non-null = c'est un "clone"/dupe,
  precise de quel parfum original il s'inspire, saisi uniquement via le
  formulaire manuel), price (real, nullable), volumeMl (defaut 100), concentration
  (enum `edt|edp|parfum|extrait|cologne`, nullable, CHECK), gender (enum
  `homme|femme|unisexe`, defaut `unisexe`, CHECK), createdAt
- **`notes`** — referentiel des notes olfactives, chaque nom unique
- **`perfume_notes`** — pivot parfum↔note avec `type` (`top|heart|base`, CHECK),
  PK composite `(perfumeId, noteId, type)`
- **`perfume_tags`** — pivot parfum↔categorie (`printemps|ete|automne|hiver|
  jour|nuit`, CHECK), PK composite `(perfumeId, tag)`. **Toujours saisi a la
  main** (voir section Scraping — Fragrantica n'expose pas cette donnee de
  facon scrapable)
- **`collection_items`** — parfums **possedes**, prives par utilisateur.
  userId→user, perfumeId→perfumes, personalNote (nullable), addedAt ; unique
  `(userId, perfumeId)`
- **`wishlists`** — listes nommees par utilisateur, ordonnees par `position`
  (integer, pour l'ordre d'affichage/navigation)
- **`wishlist_items`** — pivot wishlist↔parfum ; unique `(wishlistId, perfumeId)`
- **`feedback`** — avis envoyes depuis l'app. `username`/`email` sont
  **snapshotes** a l'envoi (pas de FK relationnelle vers `user` pour l'affichage),
  `message` avec CHECK `length >= 20`
- **`fragrantica_reference`** — dataset public (Kaggle, voir section Scraping)
  importe une fois via script ponctuel, **pas de FK vers `perfumes`**. Sert
  uniquement de source de recherche a l'ajout : id, `fragranticaUrl` (unique),
  name, brand, gender (enum, CHECK), notesTop/notesHeart/notesBase (texte,
  separes par virgules comme `ManualForm`). Une ligne ici ne devient un
  parfum dans `perfumes` que si un utilisateur la choisit puis confirme
  (`resolvePerfumeAction`/`savePerfumeAction`) — jamais automatiquement.
- **`user_preferences`** — table separee plutot qu'une colonne sur `user`
  pour ne pas toucher ce dernier (recopie a la main depuis le schema Better
  Auth, voir plus bas — un champ sans rapport avec l'auth n'a rien a y
  faire). userId (PK, →user, cascade), genderPreference (enum, CHECK,
  defaut `unisexe`) — filtre la section Decouvrir de l'accueil.

Migrations : `drizzle/*.sql` + `drizzle/meta/`. **Attention** : `drizzle-kit
push` a deja echoue une fois sur Turso pour un `ALTER TABLE ADD COLUMN NOT
NULL` sans DEFAULT (SQLite l'interdit) — toujours donner un `.default(...)`
explicite a une nouvelle colonne `notNull()` ajoutee apres coup. **`drizzle-kit
push` echoue de facon fiable et repetee sur ce projet** (`SQL_INPUT_ERROR: no
such column` sur un batch, meme pour un simple `ALTER TABLE ADD COLUMN`
nullable sans rien de special) — deja arrive au moins 3 fois independamment,
pas un incident isole. Le reflexe a prendre direct, sans reperdre de temps a
relancer `push` : lancer `drizzle-kit generate` pour obtenir le SQL exact,
puis l'executer a la main via un script `@libsql/client` ponctuel (voir
plusieurs occurrences dans l'historique git), puis supprimer le script. Le
fichier de migration genere reste utile (trace/versioning), seul `push`
lui-meme est peu fiable ici.

Commande (toujours prefixee ainsi, `dotenv` ne charge pas `.env.local` tout seul) :
```bash
npx dotenv-cli -e .env.local -- npx drizzle-kit generate
npx dotenv-cli -e .env.local -- npx drizzle-kit push
```

## Auth (Google uniquement)

- `lib/auth.ts` : instance serveur Better Auth, `drizzleAdapter` (sqlite),
  `socialProviders.google`, `user.deleteUser.enabled: true` (suppression de
  compte immediate, pas de mot de passe donc pas d'email de confirmation),
  plugin `nextCookies()` (doit rester **dernier** de la liste).
- `lib/auth-client.ts` : `createAuthClient` (`better-auth/react`), exporte
  `authClient`, `signIn`, `signOut`, `useSession`.
- `app/api/auth/[...all]/route.ts` : seule route HTTP du protocole,
  `toNextJsHandler(auth)`.
- `proxy.ts` (racine du repo) : verification **optimiste** (cookie present,
  pas de requete DB) sur toutes les routes sauf `/login`, `/api/auth`,
  `manifest.webmanifest`, `icon-*.png`, `apple-icon.png` (doivent rester
  publics pour l'installation PWA meme deconnecte). `lib/session.ts` ->
  `requireUser()` fait la vraie verification serveur (`auth.api.getSession`)
  dans chaque Server Component/action protegee — defense en deux couches.
- Chaque Server Action verifie le `userId` de la session sur CHAQUE
  lecture/ecriture (jamais de `WHERE id = ?` seul sur une table qui appartient
  a un utilisateur). Deja corrige une fois : `wishlist_items` sans jointure
  vers `wishlists.userId` (IDOR) — `assertWishlistItemOwnedByUser` dans
  `lib/actions/wishlists.ts` est le patron a suivre pour toute nouvelle action
  qui touche une table "enfant" d'une ressource appartenant a l'utilisateur.

## Scraping Fragrantica (`lib/fragrantica.ts`)

Fragrantica sert sa page de recherche cote client (Algolia + JS) : un fetch
serveur n'y voit aucun resultat. **Resolution du nom -> URL** se fait donc via
`html.duckduckgo.com/html/` (`site:fragrantica.com/perfume {query}`, HTML
statique), extraction des vraies URLs via le parametre `uddg` des liens
(selecteur `a.result__a`). Une fois l'URL Fragrantica connue, la fiche EST
statique cote serveur (microdonnees schema.org exploitables directement) :

- nom : `h1[itemprop="name"]` (cloner, retirer le `<span>` enfant, puis retirer
  le nom de marque en suffixe s'il apparait)
- marque : `p[itemprop="brand"] span[itemprop="name"]`
- genre : texte du `<span>` dans le h1 (`"for men"` / `"for women"` / `"for
  women and men"`). **Piege deja corrige** : `"for women"` contient
  litteralement la sous-chaine `"men"` (wo-**men**) — un double `.includes()`
  naif classe tout parfum femme en unisexe. Detection correcte : `includes("and")`
  -> unisexe, sinon `includes("women")` -> femme, sinon `/\bmen\b/` -> homme.
- image : `img[itemprop="image"]` (attribut `src`)
- notes : balises custom `<pyramid-level-new notes="top|middle|base">` ->
  `.pyramid-note-label` (attention : Fragrantica dit "middle", nous disons
  "heart" en base ; mapper explicitement)

**Fiabilite reseau, deux problemes distincts rencontres :**
1. DuckDuckGo peut renvoyer une page "anomaly" (rate-limit / detection bot)
   apres usage repete depuis la meme IP en peu de temps.
2. Le `fetch()` natif de Node (undici) recoit un **403 systematique** de
   Cloudflare sur `fragrantica.com`, alors que `curl` passe sans probleme
   depuis la meme machine — signature TLS/HTTP differente, tres probablement
   du fingerprinting Cloudflare specifique a undici. `fetchWithTimeout()` dans
   `lib/fragrantica.ts` ajoute des headers `Accept`/`Accept-Language` pour
   attenuer ca, mais ce n'est **pas garanti fiable en prod** (Vercel = memes
   IP/stack Node). D'ou l'existence du mode saisie manuelle : ce n'est pas un
   fallback cosmetique, c'est la voie fiable a long terme.
3. Chaque fetch est borne a 6s (`AbortSignal.timeout`) pour echouer proprement
   plutot que de bloquer la recherche indefiniment.

**`fragrantica_reference` (dataset local, prioritaire sur le scraping live)** :
tentative de peuplement en masse du catalogue (5 marques, ~100 parfums) —
stoppee en cours de route en se rendant compte qu'elle violait la propre
regle du projet ("jamais en masse", roadmap.md section 5) et le `robots.txt`
de fragrantica.com (`Disallow: ClaudeBot`, `Content-Signal: ai-train=no`).
DuckDuckGo a aussi banni l'IP en cours de route (`anomaly` persistant >6min),
rendant `searchFragrantica` inutilisable en pratique ce jour-la. Solution
retenue : l'utilisateur a fourni deux datasets Kaggle publics (telechargement
direct via `curl`, pas de scraping) —`ayushghawana/perfume-dataset` (brand/
name/type/audience, utilise pour peupler ~106 fiches Dior/LV/JPG/YSL/Givenchy
avec notes+prix de memoire) puis `olgagmiufana1/fragrantica-com-fragrance-dataset`
(`fra_cleaned.csv`, ~24k parfums **toutes marques confondues**, avec vraies
notes top/middle/base issues de Fragrantica) importe integralement dans
`fragrantica_reference`. Decision finale de l'utilisateur : **ne plus jamais
peupler `perfumes` en masse** — `fragrantica_reference` sert uniquement de
source de recherche cote `searchFragranticaCandidatesAction`/
`resolvePerfumeAction`, une ligne n'entre dans `perfumes` que si un
utilisateur la choisit et confirme, exactement comme le flux de scraping live
qu'elle complete. `resolvePerfumeAction` verifie ce dataset local **avant**
de tenter un scrape reseau (fiable, notes deja connues, aucune latence) ; le
scraping live (`scrapeFragranticaPerfume`) ne reste utilise qu'en dernier
recours pour un parfum absent du dataset (recent, ou marque non couverte).
Noms reconstruits depuis les slugs d'URL (accents perdus, ex. "Le Jour Se
Leve" au lieu de "Lève") — limite connue et acceptee du dataset, pas un bug.
Script d'import ponctuel supprime apres usage (meme convention que les
scripts de migration Drizzle, voir plus haut) ; le CSV source vit hors repo.

**Image ET description Wikipedia en filet de secours (`lib/wikipedia.ts`,
`findWikipediaPerfumeInfo`)** : les fiches resolues via `fragrantica_reference`
n'ont jamais d'image, et ni ce dataset ni le scraping Fragrantica ne donnent
de description utilisable (le champ "description" expose par Fragrantica
n'est qu'un gabarit auto-genere qui repete les notes deja affichees
ailleurs — verifie sur plusieurs fiches, aucune valeur ajoutee, delibere-
ment pas utilise). `savePerfumeAction` tente donc Wikipedia (API MediaWiki
publique, pas de souci ToS) a chaque ajout pour la description, et
seulement quand `draft.imageUrl` est deja `null` pour l'image.
`perfumes.description` (colonne texte nullable, migration `0004`) stocke le
resultat, affiche dans `PerfumeDetailSheet`. **Volontairement tres
restrictif** suite a des faux positifs constates en test : une premiere
version cherchait aussi `"{brand} {name}"` et le nom seul, ce qui a attrape
l'article de la lettre de l'alphabet "Y" pour le parfum YSL "Y", une photo
d'Audrey Hepburn pour Givenchy "L'Interdit" (le parfum lui rend hommage,
mais l'image n'est pas un flacon), et le flacon d'"Eau Sauvage" (parfum
Dior different et plus ancien) pour "Sauvage" via une redirection
Wikipedia. Design retenu : titre exact `"{name} (perfume)"` uniquement,
**aucune redirection suivie** (`prop=redirects` absent volontairement, une
redirection = article sur un AUTRE parfum la plupart du temps), page
exigee categorisee perfume/fragrance/cologne, image exigee hebergee sur
Wikimedia Commons (jamais un fichier "fair use" local a en.wikipedia.org),
description tronquee a ~600 caracteres a la derniere phrase complete
(`exintro=1&explaintext=1`, resume avant la table des matieres). Resultat :
taux de succes faible (~10-15% en test manuel) mais aucun faux positif
constate — mieux vaut ne pas
trouver d'image que d'en attribuer une fausse a la mauvaise fiche.

**Prix et description : filet de rattrapage dans `PerfumeDetailSheet`.**
Consequence directe de tout ce qui precede : ni le dataset local ni
Fragrantica ne donnent de prix, et la description Wikipedia ne touche
qu'une petite partie des fiches — beaucoup de parfums ajoutes via la
recherche/Decouvrir/pages marque se retrouvent donc sans les deux. Plutot
que d'aller chercher une source de prix qui n'existe pas gratuitement,
`PerfumeDetailSheet` affiche desormais un champ Prix et un champ
Description **modifiables pour n'importe quel parfum** (pas seulement les
fiches manuelles comme le bouton "Modifier" complet) —
`updatePerfumeExtrasAction` fait un simple `UPDATE`, meme acceptation que
`updateManualPerfumeAction` (`perfumes` sans colonne `createdBy`, n'importe
quel utilisateur connecte peut corriger). Corrige a la fois les fiches deja
en base et celles a venir.

**"Vous pourriez aimer" (`getSimilarPerfumes`, `lib/perfumes.ts`), sur
TOUTES les fiches parfum** (possedees via `PerfumeDetailSheet`, ou pas
encore ajoutees via `ReferencePerfumeSheet`) : recommandations tirees de
`fragrantica_reference`, jamais d'IA/embeddings — scoring explicable sur
des faits reels via `components/similar-perfumes-section.tsx` ->
`getSimilarPerfumesAction` : +3 meme marque, +3 supplementaires si meme
"gamme" probable (`productLine()`, qui retire concentration/annee du nom
pour reperer les flankers d'une meme ligne, ex. "Sauvage Eau de Parfum" et
"Sauvage Elixir" -> "sauvage"), +1 par note en commun (top/heart/base
confondus), +0.5 si le genre correspond (ou que l'un des deux est
unisexe). Jamais un parfum deja possede par l'utilisateur (section de
decouverte, pas un rappel de la collection), ni le parfum lui-meme. Section
masquee entierement si rien ne depasse un score de zero — jamais de
remplissage avec des resultats sans rapport.

**Piege deja corrige** : la premiere version faisait un seul `SELECT ...
WHERE (meme marque OR au moins une note commune) LIMIT 500` — sur 24k
lignes, des notes courantes (musk, vanilla, bergamot...) matchent des
milliers de parfums, et la limite unique se remplissait entierement de
correspondances par note avant meme d'atteindre les lignes de la marque
source (bien plus rares) : aucun flanker de la meme ligne ne remontait
jamais, meme pour un parfum aussi connu que Sauvage. Corrige en deux
requetes separees (marque, puis notes), chacune avec sa propre limite,
fusionnees avant le scoring.

`ReferencePerfumeSheet` accepte un `onSelectSimilar` optionnel : taper sur
une recommandation remplace le parfum affiche dans la meme sheet (le
composant `Body` est garde par `key={perfume.fragranticaUrl}` pour forcer
un vrai remount — sinon les champs prix/description conserveraient les
valeurs tapees pour le parfum precedent). Depuis `PerfumeDetailSheet`
(parfum possede), une recommandation ouvre forcement un
`ReferencePerfumeSheet` a la place (jamais un autre `PerfumeDetailSheet` :
le filtre "jamais possede" du scoring garantit que ce sera toujours un
parfum pas encore ajoute) — `LibrarySectionView` gere donc deux sheets en
parallele (`selected` et `selectedSimilar`) et bascule de l'un a l'autre.

**Saisons/jour-nuit NON scrapables** : le widget "When To Wear" de Fragrantica
(`<seasons-rating-new>`) est rendu 100% cote client par Vue, aucune donnee
dans le HTML statique (verifie en profondeur, y compris apres scroll/lazy-load).
Reste donc un champ saisi a la main (checkboxes) dans le formulaire
d'ajout — ne pas retenter de le scraper sans navigateur headless (explicitement
hors scope du projet).

**Note securite** : lors de cette investigation, une ressource tierce
suspecte (`static.cheftoondiligord.site`) a ete observee injectee dans le HTML
de Fragrantica, avec du JS visant a neutraliser des pubs detournees — signe
que leur regie pub a ete compromise a un moment. Sans impact direct sur
Snifary, mais a garder en tete si on refait du scraping cible sur ce site.

**Flow d'ajout complet** (`lib/actions/perfumes.ts`, UI dans
`components/add-perfume-dialog.tsx`, ouvert par `components/add-fab.tsx`) :

1. `searchLocalPerfumesAction` (cache Turso, quasi instantane) et
   `searchFragranticaCandidatesAction` tournent en **parallele independant**
   cote UI (deux `useEffect` separes) : le cache local s'affiche tout de
   suite, un echec/lenteur reseau sur le second n'affecte jamais le premier.
   **Piege deja corrige** : sans try/catch autour de l'appel, un echec reseau
   laissait le spinner "Recherche..." tourner indefiniment (ressemblait a
   "l'app est cassee"). En interne, `searchFragranticaCandidatesAction`
   interroge `fragrantica_reference` (local, fiable) ET DuckDuckGo (`.catch`
   -> `[]` si indisponible) en parallele, fusionne par URL.
2. `resolvePerfumeAction(url)` : cache hit (`findPerfumeByFragranticaUrl`) ->
   id direct ; sinon `fragrantica_reference` (notes deja connues, pas de
   reseau) ; sinon scrape live en dernier recours -> brouillon **jamais
   ecrit en base** a ce stade.
3. **Plus d'etape de confirmation manuelle** (ecran "Confirme les infos" +
   `ConfirmForm` supprimes) : ni le dataset local ni Fragrantica n'exposent
   prix/contenance/categories de facon fiable, donc rien de reel a faire
   confirmer par l'utilisateur a chaque ajout — demande explicite ("c'est pas
   a moi de confirmer"). `handlePickCandidate` appelle directement
   `savePerfumeAction` des que `resolvePerfumeAction` renvoie un brouillon :
   `price: null`, `volumeMl: 100`, `tags: []`, `gender` = celui du brouillon,
   `concentration` devinee depuis le texte du nom (`guessConcentration()`
   dans `add-perfume-dialog.tsx` — repere "eau de parfum"/"eau de
   toilette"/"elixir"/"extrait"/"cologne"/"parfum" en toutes lettres, sinon
   `null`). `savePerfumeAction` reste le **seul moment d'ecriture** (upload
   Cloudinary de l'image Fragrantica via `uploadImageFromUrl` si presente,
   sinon tentative Wikipedia, insertion perfume + notes). Consequence
   assumee : un parfum ajoute par recherche (dataset ou scrape, donc
   `fragranticaUrl !== null`) n'a **pas** de bouton "Modifier" (voir point 7)
   — impossible de lui ajouter un prix ou une photo apres coup pour
   l'instant ; a rouvrir si ca devient genant a l'usage.
4. Si aucun resultat (ni local ni Fragrantica) -> bouton "+ Ajouter un parfum
   manuellement" -> `ManualForm` (nom, marque, image uploadee directement via
   `uploadPerfumeImageAction`, notes en champs texte separes par virgules,
   memes champs prix/contenance/concentration/genre/tags) ->
   `createManualPerfumeAction`. `fragranticaUrl` reste `null` pour ces entrees.
5. Suppression de fond (`lib/remove-background.ts`, `@imgly/background-removal`,
   modele `isnet_quint8`, 100% navigateur/WASM, import dynamique) appliquee
   **uniquement sur les images uploadees manuellement** (fichier local, pas de
   souci CORS). Les images scrapees depuis Fragrantica ou trouvees sur Wikipedia
   ne passent PAS par ce traitement (fetch cross-origin depuis le navigateur
   serait fragile, et se fait de toute facon cote serveur dans
   `savePerfumeAction` maintenant qu'il n'y a plus d'etape de confirmation
   ou brancher un choix d'image cote client).
6. Champ "Clone" dans `ManualForm` : checkbox qui, si cochee, affiche un champ
   texte libre stockant dans `perfumes.inspiredBy` le nom du parfum original
   dont ce clone/dupe s'inspire. Uniquement dans le formulaire manuel (n'a pas
   de sens pour un parfum scrape, qui EST deja la fiche originale).
7. Un parfum saisi manuellement (`fragranticaUrl === null`) est modifiable a
   posteriori : bouton "Modifier" dans `PerfumeDetailSheet` (visible seulement
   si `fragranticaUrl === null`) -> `EditPerfumeDialog`, qui reutilise
   **le meme composant `ManualForm`** (exporte depuis `add-perfume-dialog.tsx`)
   pre-rempli via sa prop `initial`, mais appelle `updateManualPerfumeAction`
   au lieu de `createManualPerfumeAction`. Cette action **remplace entierement**
   les notes/tags existants (delete + re-insert) plutot que de diffier — plus
   simple, suffisant a ce volume. Comme `perfumes` n'a pas de colonne
   `createdBy`, n'importe quel utilisateur connecte peut editer une fiche
   manuelle existante ; accepte comme limite connue a l'echelle de ce projet.

Dans tous les cas, l'ajout au final n'est **jamais global** : `perfumes` est un
cache partage (le meme parfum, meme id, pour tout le monde), mais posseder ce
parfum est toujours une ligne separee dans `collection_items`/`wishlist_items`
liee au `userId` de qui a fait l'ajout.

**Bouton "+" different selon le contexte** (`components/add-fab.tsx`) : dans
la collection, un seul choix a du sens -> bouton simple qui ouvre direct
`AddPerfumeDialog`. Dans une wishlist, le "+" se deploie en 2 options (ajouter
un parfum / creer une nouvelle wishlist) car les deux actions sont legitimes
depuis cet ecran.

**Fleches precedent/suivant** de `LibrarySectionView` : entre deux wishlists,
navigation libre dans les deux sens. Depuis la collection (`/stats` et
`/library/collection`), en revanche, uniquement un "next" vers la premiere
wishlist — jamais de "prev" (la collection est toujours le point de depart).
Depuis une wishlist, le "prev" ne remonte jamais jusqu'a la collection non
plus, seulement vers la wishlist precedente — demande explicite d'origine
pour ne pas suggerer un lien navigable *retour* vers la collection depuis
une wishlist. **C'est ce fil collection -> wishlist1 -> wishlist2 -> ...
qui fait office de "carrousel"** maintenant que `/wishlists` a ete retire de
la nav (voir plus haut) : la collection (bouton "Collection" de la nav) est
devenue le seul point d'entree vers les wishlists.

**Suppression de fond** (`lib/remove-background.ts`, `@imgly/background-removal`,
modele `isnet_quint8`) appliquee sur toute image uploadee manuellement (creation
ET edition, meme composant `ManualForm` -> meme `handleFile`). **Non-bloquante** :
si elle echoue (CDN `staticimgly.com` injoignable, WASM non supporte, etc.),
l'image d'origine est uploadee quand meme (`console.error` + toast info) plutot
que de bloquer tout l'ajout/edition. **Piege deja corrige** : Next.js limite le
corps d'une requete Server Action a 1 Mo par defaut — une photo de telephone
reencodee en PNG avec canal alpha depasse ca facilement, et `uploadPerfumeImageAction`
(ou l'upload avatar, meme risque) echouait silencieusement avec un message
generique "Impossible de traiter l'image" qui ne disait pas laquelle des deux
etapes (suppression de fond vs upload) avait plante. Corrige via
`experimental.serverActions.bodySizeLimit: "10mb"` dans `next.config.ts` — a
garder si on retouche cette config, sans quoi le bug revient silencieusement.

## Navigation / structure des pages

- `app/login/page.tsx` — hors du groupe `(app)`, seule page publique (avec
  `/api/auth/*` et les assets PWA). Sa propre mise en page centree +
  `BrandHeader` (logo + tagline + toggle, style "splash").
- `app/(app)/layout.tsx` — coque partagee par toutes les pages connectees :
  `AppTopBar` (fixe en haut, flottant SANS fond/bordure — logo "Snifary" +
  tagline aleatoire + toggle theme, cf section UI) et `BottomNav` (fixe en
  bas, 5 icones : Avis/Collection/Accueil/Decouvrir/Profil). **Plus d'icone
  "Wishlists" dediee** (retiree, demande explicite) : les wishlists restent
  atteignables depuis Collection via le carrousel prev/next deja existant
  (voir plus bas), elles n'ont juste plus leur propre point d'entree direct
  dans la nav — ce slot accueille desormais Decouvrir.
- `app/(app)/page.tsx` (Accueil) — section **"Decouvrir"** en tout premier
  (`components/discover-section.tsx`) : tirage aleatoire de 12 parfums dans
  `fragrantica_reference` (~24k, toutes marques), filtre par
  `userPreferences.genderPreference` (reglable dans Profil, defaut
  `unisexe` = pas de filtre), en excluant ce que l'utilisateur possede deja.
  Jamais d'image (le dataset n'en a pas) — cartes compactes en scroll
  horizontal plutot que le grid a vignettes utilise ailleurs. Lien "voir
  tout" -> `/discover` (version detaillee, voir plus bas). Puis apercu de
  chaque section (collection d'abord, puis chaque wishlist dans l'ordre de
  `position`), lien "voir tout" vers la page dediee. Bouton "+ Nouvelle
  wishlist" en bas.
- `app/(app)/brands/[brand]/page.tsx` — catalogue complet d'une marque, tire
  du meme dataset local (`getBrandCatalog`, comparaison de marque insensible
  a la casse). Atteinte en tapant le nom de la marque (devenu lien) dans
  `PerfumeDetailSheet`. Vue dediee `components/brand-catalog-view.tsx` (pas
  `LibrarySectionView`, pensee pour des items **possedes** avec notes/tags —
  incompatible avec des lignes du dataset qui n'ont ni l'un ni l'autre) :
  recherche texte + filtre genre en local (pas de tags dans ce dataset).
- **Decouvrir et les pages marque n'ajoutent jamais directement** : tape sur
  un parfum -> `ReferencePerfumeSheet` (`components/reference-perfume-sheet.tsx`)
  affiche sa fiche complete (notes, genre) avec deux champs optionnels
  prix/description, et des cases a cocher "Ma collection" + une par wishlist
  — **plusieurs cibles possibles a la fois**, contrairement au reste de
  l'app. Le vrai bouton d'ecriture est explicitement mis en avant
  (`size="lg"`, pleine largeur, pas un simple lien texte) — demande
  explicite apres un premier essai juge trop discret. `saveReferencePerfumeAction`
  (`lib/actions/perfumes.ts`) resout + ecrit le parfum une seule fois puis
  boucle sur les cibles cochees (`collection_items` + `addItemToWishlistAction`
  par wishlist, qui verifie deja la propriete). Une premiere version
  (`quickAddToCollectionAction`, supprimee) ajoutait direct a la collection
  au tap — corrige suite a un retour explicite : pas de moyen de choisir une
  wishlist, ni de voir la fiche avant d'ecrire quoi que ce soit.
- `app/(app)/library/collection/page.tsx` et
  `app/(app)/library/wishlist/[id]/page.tsx` — vue complete d'**une seule**
  section a la fois (`components/library-section-view.tsx`, partage) :
  grille/liste, modal de filtres, `AddFab`. Navigation prev/next **limitee aux
  wishlists entre elles** (la collection n'est jamais accessible depuis une
  wishlist par ces fleches, demande explicite) ; la collection n'a pas de
  prev, et son next pointe vers la premiere wishlist. **C'est ce carrousel
  prev/next, ancre sur `/stats` (bouton "Collection" de la nav), qui sert
  maintenant de seul chemin vers les wishlists** — `app/(app)/wishlists/page.tsx`
  (redirection vers la premiere wishlist, ex-cible du bouton "coeur") a ete
  supprime : redondant, la nav "Collection" y menait deja via le "next".
- `app/(app)/discover/page.tsx` — version detaillee de la section Decouvrir
  de l'accueil, cible du bouton "Decouvrir" de la bottom nav (remplace
  l'ancien "coeur"/Wishlists). `components/discover-page-view.tsx` : 30
  suggestions au depart (`getDiscoverPerfumes(..., 30)`), recherche libre
  dans tout `fragrantica_reference` (`searchReferencePerfumes`, pas de
  filtre genre — coherent avec la recherche principale), filtre genre en
  plus (s'applique aussi bien au tirage qu'aux resultats de recherche,
  cote client), bouton "Autre selection" (`refreshDiscoverPerfumesAction`)
  pour retirer un nouveau lot sans quitter la page. Meme
  `ReferencePerfumeSheet` que Decouvrir/pages marque au tap.
- `app/(app)/stats/page.tsx` — cible du bouton "Collection"/bibliotheque de la
  bottom nav (route `/stats` conservee, label change). Affiche 2 chips
  compactes ("N parfums possedes", "X€ depenses" — `StatChip` local au fichier,
  passees via la prop `aside` de `LibrarySectionView`) **au-dessus** de la
  collection complete (meme composant que `/library/collection`) — assez
  visibles pour se voir au premier coup d'oeil, mais pas de grosses cartes
  chiffrees comme avant : la collection reste le contenu principal de la page.
- `app/(app)/profile/page.tsx` — avatar (upload/recadrage/suppression via
  `components/avatar-uploader.tsx` + `avatar-crop-dialog.tsx`,
  `react-easy-crop`), nom modifiable, deconnexion, suppression de compte,
  et **preference de genre** pour la section Decouvrir (selecteur
  homme/femme/unisexe, `updateGenderPreferenceAction` ->
  `user_preferences.gender_preference`).
- `app/(app)/feedback/page.tsx` — formulaire, bouton actif a partir de 20
  caracteres (doublee par le CHECK SQL). Journal des nouveautes
  (`components/changelog.tsx`) affiche en dessous, version la plus recente
  en premier — donnees statiques maintenues a la main dans ce fichier a
  chaque changement notable, pas de table dediee (volume trop faible pour
  le justifier).

## UI / conventions a respecter

- **Coque mobile** : tout est contraint a `max-w-md`, y compris le layout
  `(app)` et l'`AppTopBar`.
- **AppTopBar vs BrandHeader** : ce sont deux composants distincts qui font un
  logo similaire mais dans des contextes differents. `AppTopBar`
  (`components/app-top-bar.tsx`) = persistant sur toutes les pages `(app)`,
  flottant, sans fond ni bordure (demande explicite : pas de "barre" visible,
  juste le logo+tagline+toggle qui flottent sur le fond de la page).
  `BrandHeader` (`components/brand-header.tsx`) = utilise uniquement par
  `/login`, plus "splash". Si l'un des deux change de logique de mise en page,
  verifier si l'autre doit suivre.
- **Toggle theme** : un seul composant nu reutilisable,
  `ThemeToggleButton` (`components/theme-toggle.tsx`). Pas de bouton flottant
  global separe (supprime — redondant maintenant que `AppTopBar` et
  `BrandHeader` l'integrent chacun sur leur perimetre).
- **Dialogs vs Sheets** : `AddPerfumeDialog` et `NewWishlistDialog` sont des
  **Dialog centres** (`components/ui/dialog.tsx`, hauteur `h-[80vh]` fixe pour
  le premier). `PerfumeDetailSheet` est un **Sheet bas** mais **jamais en
  `h-[Nvh]` fixe** : utiliser `top-<offset> bottom-0` (sans hauteur explicite)
  pour que la hauteur soit "l'espace reellement restant", pas un pourcentage
  de viewport qui deborde sur la bottom nav ou se fait rogner par le chrome
  mobile (barre d'adresse dynamique). Deja corrige une fois pour
  `PerfumeDetailSheet`, garder ce reflexe pour tout futur bottom sheet.
- **Images de parfum** : toujours `object-contain` (jamais `object-cover`) —
  demande explicite de ne **jamais rogner** la photo du flacon, quitte a avoir
  des bandes vides. S'applique a `PerfumeCard`, `SectionPreview`, et
  `PerfumeDetailSheet`. La taille du conteneur (carre, dimensions fixes) ne
  change pas, seul le `object-fit` differe.
- **Police** : titres/logo = `font-heading` (mappe sur Rowdies, 3 graisses
  seulement 300/400/700, pas d'italique). Corps de texte = `font-sans`
  (Geist). **Piege deja corrige** : le scaffold shadcn initial avait
  `--font-sans: var(--font-sans)` (auto-reference dans `app/globals.css`) —
  Geist ne s'appliquait donc jamais reellement avant ce fix. Verifier que ce
  mapping reste `var(--font-geist-sans)` si `globals.css` est retouche.
- **Echelle globale** : `html { font-size: 108% }` dans `globals.css` — levier
  volontaire pour agrandir toute l'app d'un coup (tous les `text-*`/spacings
  Tailwind sont en `rem`) plutot que de reprendre chaque composant. Eviter les
  tailles en `text-[Npx]` arbitraires (bypassent ce mecanisme) — prefer les
  classes `text-xs/sm/base/...` standard.
- **Toasts** : `position="top-center"` (demande explicite, pas la position
  par defaut de sonner).
- **PWA** : `app/manifest.ts` + icones generees via `next/og` `ImageResponse`
  (`public/icon-192.png`, `icon-512.png`, `apple-icon.png` — deja generees et
  committees, pas besoin de regenerer sauf changement de charte graphique).
  Palette de marque (mockups d'origine) : fond aubergine fonce `#2f1a2e`,
  accent tan `#c9b896`, rouge baie `#e0392c`/`#c0392b`.

## Deploiement

- GitHub `Amiiine27/snifary` -> Vercel, deploiement auto a chaque push sur
  `main`. **Toujours verifier** apres un push que le bon commit est bien
  "Promoted to Production" dans l'onglet Deployments Vercel — un "Redeploy"
  manuel sur un ancien deploiement dans la liste republie le code figé a ce
  moment-la, pas le HEAD de `main` (deja arrive une fois, a cause une
  regression qui semblait etre un "retour en arriere" du code).
- Variables d'environnement (`.env.local`, jamais committe — seul
  `.env.local.example` vide est versionne) : `TURSO_DATABASE_URL`,
  `TURSO_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CLOUDINARY_CLOUD_NAME`,
  `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Doivent exister **au moment
  du build** sur Vercel (Next evalue `db/index.ts` pendant "collect page
  data"), pas seulement au runtime — sinon `URL_INVALID` sur Turso.
- `vercel.json` : `{"regions": ["dub1"]}` — voir section Stack.

## A eviter / lecons apprises (ne pas refaire)

- Ne pas utiliser `@better-auth/cli` (deprecated, vulnerabilites) pour
  regenerer le schema auth — verifier a la main contre
  `node_modules/@better-auth/core/src/db/get-tables.ts`.
- Ne pas faire `object-cover` sur une image de parfum, nulle part.
- Ne pas mettre une hauteur `h-[Nvh]` fixe sur un bottom sheet — utiliser
  `top-<offset> bottom-0`.
- Ne pas faire de double `.includes()` naif sur des mots qui se contiennent
  l'un l'autre (`"women"` contient `"men"`) — toujours reflechir aux cas de
  sous-chaine avant un `.includes()` de classification.
- Ne pas ajouter une colonne `notNull()` sans `.default(...)` sur une table
  existante (SQLite refuse `ALTER TABLE ADD COLUMN NOT NULL` sans defaut).
- Ne pas supposer qu'un `Redeploy` Vercel republie le HEAD de `main` — ca
  republie le commit fige de ce deploiement precis.
- Ne pas oublier `requireUser()` + filtre `userId` sur une nouvelle Server
  Action qui touche une donnee privee, et verifier la chaine complete si la
  table est "enfant" d'une autre ressource utilisateur (voir IDOR wishlist).
