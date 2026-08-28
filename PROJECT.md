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
(coque centree, pensee pour etre installee comme une PWA sur telephone —
mais responsive : la coque s'elargit par palier sur tablette/PC, voir section
UI). Chaque utilisateur gere : une **collection** (parfums possedes) et
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
  `message` avec CHECK `length >= 20`, `archived` (boolean, defaut `false`) —
  archiver un avis le sort du badge de la cloche admin (voir section Admin)
  sans le supprimer ; suppression definitive possible separement
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

**Le scraping live de fragrantica.com a ete entierement retire** (recherche
DuckDuckGo -> HTML -> extraction cheerio). Historiquement, la resolution nom
-> URL passait par `html.duckduckgo.com/html/` (Fragrantica sert sa page de
recherche cote client, Algolia + JS, invisible a un fetch serveur), puis la
fiche elle-meme etait scrapee (microdonnees schema.org). Deux problemes
distincts rendaient deja ca fragile : DuckDuckGo pouvait renvoyer une page
"anomaly" (rate-limit) apres usage repete depuis la meme IP, et le `fetch()`
de Node (undici) recevait un 403 systematique de Cloudflare sur
`fragrantica.com` (signature TLS differente de `curl`, qui passait). **Le
coup de grace** : en reinvestiguant pour la recherche d'images (voir plus
bas), un test direct a montre que fragrantica.com sert desormais un vrai
challenge Cloudflare **JS** (`Cf-Mitigated: challenge`, page "Just a
moment...") meme via `curl` — plus contournable du tout, y compris depuis
Vercel. `lib/fragrantica.ts` ne contient donc plus que `fimgsImageUrl`/
`findFimgsImage` (le CDN images, voir plus bas) ; `searchFragrantica`,
`scrapeFragranticaPerfume` et le type `FragranticaCandidate` ont ete
supprimes plutot que laisses en code mort inatteignable.

**`fragrantica_reference` (dataset local) est donc devenue la seule source
de recherche/resolution**, plus une simple priorite sur un scraping live
desormais impossible. Tentative initiale de peuplement en masse du catalogue
(5 marques, ~100 parfums) — stoppee en se rendant compte qu'elle violait la
propre regle du projet ("jamais en masse", `roadmap.md` section 5) et le
`robots.txt` de fragrantica.com (`Disallow: ClaudeBot`,
`Content-Signal: ai-train=no`). Solution retenue : l'utilisateur a fourni
deux datasets Kaggle publics (telechargement direct via `curl`, pas de
scraping) — `ayushghawana/perfume-dataset` (brand/name/type/audience, utilise
pour peupler ~106 fiches Dior/LV/JPG/YSL/Givenchy avec notes+prix de memoire)
puis `olgagmiufana1/fragrantica-com-fragrance-dataset` (`fra_cleaned.csv`,
~24k parfums **toutes marques confondues**, avec vraies notes top/middle/base
issues de Fragrantica) importe integralement dans `fragrantica_reference`.
Decision finale de l'utilisateur : **ne plus jamais peupler `perfumes` en
masse** — `fragrantica_reference` sert uniquement de source de recherche
cote `searchFragranticaCandidatesAction`/`resolvePerfumeAction`, une ligne
n'entre dans `perfumes` que si un utilisateur la choisit et confirme.
`resolvePerfumeAction` a desormais 2 branches seulement : cache
(`perfumes`, id direct si deja connu), sinon `fragrantica_reference` — si
absent des deux, `Error("Parfum introuvable")` plutot qu'un troisieme
recours reseau. Consequence assumee : un parfum trop recent pour le
snapshot du dataset (ex. Prada Paradigme, sorti en 2025) ou d'une marque non
couverte n'est **plus resolvable du tout** par recherche — seule la saisie
manuelle (`ManualForm`) reste disponible pour ce cas, ce qui etait deja la
voie jugee fiable a long terme. Noms reconstruits depuis les slugs d'URL
(accents perdus, ex. "Le Jour Se Leve" au lieu de "Lève") — limite connue et
acceptee du dataset, pas un bug. Script d'import ponctuel supprime apres
usage (meme convention que les scripts de migration Drizzle, voir plus
haut) ; le CSV source vit hors repo.

**Recherche dans `AddPerfumeDialog` : dataset local uniquement**
(`components/add-perfume-dialog.tsx`) — la recherche dans les parfums deja
enregistres (`perfumes`, ex-`searchLocalPerfumesAction`/`findPerfumesByName`,
supprimees) a ete retiree, demande explicite. Raison : contrairement au
dataset (`fragrantica_reference`, image garantie via `fimgsImageUrl`), une
ligne `perfumes` n'a pas forcement d'image (ajout manuel, ou ancien ajout
d'avant le pipeline fimgs.net) — melanger les deux dans une liste au rendu
desormais identique (nom/marque/photo, voir plus bas) rendait ce manque
visible et incoherent. `searchFragranticaCandidatesAction` ne filtre donc
plus les candidats deja enregistres (inutile sans recherche locale en
parallele a dedupliquer visuellement) : un candidat deja dans `perfumes`
reste visible, le cliquer reutilise la ligne existante
(`resolvePerfumeAction`) plutot que d'en recreer une. **Consequence
assumee** (**risque explicitement accepte**, pas une regression manquee) :
un parfum ajoute manuellement (`fragranticaUrl === null`, jamais dans le
dataset) ou trop recent pour le snapshot (ex. Prada Paradigme) redevient
introuvable en recherche — pour lui ajouter une seconde variante, refaire
"Ajouter manuellement" cree desormais une fiche separee plutot que de
reutiliser la premiere.

**Recherche "tous les mots, n'importe quel ordre"** (`searchWords()`,
`lib/perfumes.ts`, factorisee et reutilisee par `searchFragranticaReference`
et `searchReferencePerfumes`) : chaque mot de
la requete devient sa propre condition `LIKE` (nom OU marque), combinees en
`AND` — plutot qu'un seul `LIKE '%requete entiere%'` qui exige une
sous-chaine continue. **Piege reel corrige** : chercher "valentino born in
roma intense" ne remontait pas "Valentino Uomo Born In Roma Intense" en
sous-chaine continue, le mot "Uomo" cassant la continuite. Avec l'AND de
mots, chaque terme (valentino/born/in/roma/intense) matche independamment
n'importe ou dans nom+marque, ordre et mots en plus (comme "Uomo") n'ayant
plus d'importance — comportement standard de n'importe quelle barre de
recherche.

**Images via le CDN Fragrantica (`fimgsImageUrl`/`findFimgsImage`,
`lib/fragrantica.ts`) : source prioritaire, avant Open Beauty Facts et
Wikipedia.** Fragrantica sert ses photos depuis un sous-domaine CDN separe,
`fimgs.net`, qui n'est PAS derriere le meme challenge Cloudflare que le
reste du site (voir plus haut) — verifie manuellement (`curl`, `WebFetch`,
echantillon aleatoire de `fragrantica_reference` incluant des marques tres
confidentielles comme "O Boticario" ou "Miguel Matos") : 100% de reussite,
vraies photos distinctes a chaque fois, `robots.txt` de ce sous-domaine
n'interdisant que le crawler de la Wayback Machine. Pattern simple et
predictible : `https://fimgs.net/mdimg/perfume/o.<id>.jpg`, ou `<id>` est le
nombre en fin d'URL Fragrantica (ex. `Sauvage-31861.html` -> `31861`), deja
present sur toute ligne `fragrantica_reference` — aucune requete reseau
supplementaire pour l'obtenir. Deux usages
distincts, volontairement asymetriques : `fimgsImageUrl` (pure, pas de
verification) sert a l'**affichage** — `toReferencePerfume` dans
`lib/perfumes.ts` la calcule pour chaque `ReferencePerfume`, et
`ReferencePerfumeThumb` (`components/reference-perfume-thumb.tsx`, partagee
par Decouvrir, pages marque, "Vous pourriez aimer" et `ReferencePerfumeSheet`)
gere le rare cas d'echec avec un repli visuel (`onError`) plutot qu'un
aller-retour reseau par carte dans une liste de 30+ resultats. `findFimgsImage`
(avec verification HEAD) sert a la **sauvegarde** — `findImageAndDescription`
(`lib/actions/perfumes.ts`) s'y fie avant de lancer un upload Cloudinary,
pour ne jamais faire echouer tout un `savePerfumeAction` sur une image
absente. Contrairement a Open Beauty Facts/Wikipedia (matching flou par nom,
avec les faux positifs deja rencontres ci-dessous), c'est une correspondance
**exacte** par id — aucun risque de confondre deux parfums. **Backfill
ponctuel** effectue sur les `perfumes` deja en base sans image
(`imagePublicId IS NULL AND "fragranticaUrl" IS NOT NULL`, script
`@libsql/client` + `cloudinary.uploader.upload` ponctuel, meme convention
que les migrations Drizzle) : seulement 6 lignes concernees a l'echelle de
ce projet, 100% de reussite. Les nouveaux ajouts en beneficient
automatiquement via `findImageAndDescription`, seul ce rattrapage retroactif
etait a faire a la main une fois.

**Image ET description Wikipedia en filet de secours (`lib/wikipedia.ts`,
`findWikipediaPerfumeInfo`)** : reste utile pour la description (fimgs.net et
Open Beauty Facts n'en fournissent aucune) et pour l'image dans les cas rares
ou fimgs.net et Open Beauty Facts echouent tous les deux. Ni `fragrantica_reference`
ni le scraping Fragrantica ne donnent de description utilisable (le champ
"description" expose par Fragrantica n'est qu'un gabarit auto-genere qui
repete les notes deja affichees ailleurs — verifie sur plusieurs fiches,
aucune valeur ajoutee, deliberement pas utilise). `savePerfumeAction` tente
donc Wikipedia (API MediaWiki publique, pas de souci ToS) a chaque ajout pour
la description, et seulement quand aucune des sources precedentes n'a trouve
d'image.
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

**Open Beauty Facts (`lib/openbeautyfacts.ts`) : deuxieme source d'image
(apres fimgs.net), essayee AVANT Wikipedia.** Base ouverte et collaborative (soeur d'Open Food
Facts, licence Open Database License), API publique faite pour un usage
programmatique — pas de souci ToS ici non plus. Couverture testee a la
main : solide sur les grosses marques (Dior, Chanel, Armani, YSL, Givenchy,
JPG, Guerlain, Versace, Hugo Boss, Calvin Klein, Burberry...), quasi vide
sur certaines (Prada: 0 resultat) et sur la longue traine du dataset
(~24k parfums) — c'est une base "scan de code-barres en rayon", forcement
plus faible sur le niche/vintage. Pas de champ description exploitable
(verifie : `generic_name`/`ingredients_text` vides sur les parfums), donc
la description reste Wikipedia seul.

**Piege deja corrige sur le matching Open Beauty Facts.** Meme categorie de
probleme que Wikipedia, retrouvee en testant a la main avant de brancher
quoi que ce soit : chercher "Stronger With You" (Armani) remontait la photo
de "Stronger With You **Intensely**" (un flanker different), et chercher
"Eau Sauvage" remontait le flacon de "Sauvage" (parfum different) car les
noms de produits sur Open Beauty Facts sont des titres de fiche retail tres
bruites/multilingues (ex. "Emporio Armani Stronger With You Intensely Eau
de Parfum Erkek Parfümü"). Corrige avec deux regles : (1) tous les mots
significatifs du nom recherche doivent apparaitre chez le candidat (le
candidat peut avoir des mots EN PLUS -- bruit retail comme "Pour Homme
Refillable" -- jamais EN MOINS), et (2) rejet si le candidat contient un mot
d'une liste `VARIANT_MARKERS` (intense, elixir, night, gold...) absent du
nom recherche. Le cas "Eau Sauvage"/"Sauvage" reste un risque residuel
accepte (les deux se reduisent au meme token "sauvage" une fois "eau"
retire, comme pour Wikipedia) — pas de mot differenciateur disponible pour
trancher automatiquement ce cas precis.

**Prix et description : filet de rattrapage dans `PerfumeDetailSheet`.**
Consequence directe de tout ce qui precede : ni le dataset local ni
Fragrantica ne donnent de prix, et Open Beauty Facts + Wikipedia combines
ne couvrent qu'une partie des descriptions/images — beaucoup de parfums
ajoutes via la recherche/Decouvrir/pages marque se retrouvent quand meme
sans l'un ou l'autre. Plutot que d'aller chercher une source de prix qui
n'existe pas gratuitement, `PerfumeDetailSheet` affiche desormais un champ
Prix et un champ Description **modifiables pour n'importe quel parfum**
(pas seulement les fiches manuelles comme le bouton "Modifier" complet) —
`updatePerfumeExtrasAction` fait un simple `UPDATE`, meme acceptation que
`updateManualPerfumeAction` (`perfumes` sans colonne `createdBy`, n'importe
quel utilisateur connecte peut corriger). Corrige a la fois les fiches deja
en base et celles a venir. **La description n'est en revanche JAMAIS
demandee a l'utilisateur au moment de l'ajout** (`ReferencePerfumeSheet` n'a
plus de champ Description du tout, seulement Prix) — demande explicite,
trouvee automatiquement (Open Beauty Facts n'en a pas, donc Wikipedia dans
les faits) ou laissee vide, jamais a la charge de l'utilisateur a la
creation. Seul le filet de rattrapage sur une fiche deja existante
(`PerfumeDetailSheet`) reste editable, pour corriger apres coup.

**Meme filet pour l'image** : petit bouton camera en overlay (coin bas-droit
de la photo) dans `PerfumeDetailSheet`, disponible pour n'importe quel
parfum (pas seulement manuel). Reutilise exactement le pipeline de
`ManualForm` : `removeImageBackground()` (best-effort, jamais bloquant, cf
section Flow d'ajout point 5) -> `uploadPerfumeImageAction` (upload direct,
pas de scraping) -> nouvelle `updatePerfumeImageAction` (`UPDATE` simple,
meme acceptation "n'importe qui peut corriger"). Preview locale en `<img>`
brut (pas `next/image`) tant que c'est un blob non uploade — meme piege deja
rencontre et contourne dans `ManualForm` : `next/image` ne sait pas
optimiser une URL `blob:`.

**Suppression de fond automatique sur les images trouvees (`lib/refine-image.ts`,
`refineNewPerfumeImage`)** : `savePerfumeAction`/`saveReferencePerfumeAction`
renvoient desormais `{perfumeId, isNew, imageUrl}` (URL Cloudinary, pas juste
le `public_id`) plutot qu'un simple id. Cote client
(`add-perfume-dialog.tsx`, `reference-perfume-sheet.tsx`), si `isNew` et
qu'une image a ete trouvee, `refineNewPerfumeImage` est appelee avec
**`await`** (pas fire-and-forget — demande explicite pour ne jamais laisser
voir la version fond blanc, quitte a rallonger l'attente avant le toast
"Ajoute"/"Enregistre" ; un indicateur "Ajout en cours..." couvre cette
attente dans `AddPerfumeDialog`, `ReferencePerfumeSheet` avait deja
"Enregistrement..." sur son bouton) : retelecharge l'image depuis
Cloudinary, la repasse dans le meme pipeline WASM que `ManualForm`
(`removeImageBackground` -> `uploadPerfumeImageAction` ->
`updatePerfumeImageAction`), puis l'ajout se termine avec l'image deja en
fond transparent. **Pourquoi apres coup et pas directement dans
`findImageAndDescription`** : `removeImageBackground` est 100%
navigateur/WASM (aucun equivalent Node cote serveur, voir
`lib/remove-background.ts`), et les images trouvees automatiquement
(fimgs.net, Open Beauty Facts, Wikipedia) ne peuvent pas etre retelechargees
cote client pour y etre appliquees **avant** l'upload — `fimgs.net` ne sert
aucun header CORS (verifie : ni `Access-Control-Allow-Origin` de base, ni
meme avec un header `Origin` explicite), la lecture du blob serait bloquee
par le navigateur. Cloudinary, lui, sert systematiquement
`Access-Control-Allow-Origin: *` (verifie) : la seule fenetre ou une image
tierce redevient exploitable cote client, c'est **apres** son premier upload
sur Cloudinary — d'ou le rattrapage en 2 temps plutot qu'en un seul.
Uniquement declenche pour un tout nouveau parfum (`isNew`), jamais quand
`resolveAndSaveReferencePerfume`/`savePerfumeAction` retombent sur un
`perfumes` deja existant (l'image a deja ete traitee, ou peut deja etre
corrigee a la main via le bouton camera ci-dessus). Meme reflexe
best-effort que le reste du pipeline images : un echec (`catch` +
`console.error`) laisse simplement l'image d'origine en place, jamais
d'erreur remontee a l'utilisateur.

**"Vous pourriez aimer" (`getSimilarPerfumes`, `lib/perfumes.ts`), sur
TOUTES les fiches parfum** (possedees via `PerfumeDetailSheet`, ou pas
encore ajoutees via `ReferencePerfumeSheet`) : recommandations tirees de
`fragrantica_reference`, jamais d'IA/embeddings — scoring explicable sur
des faits reels via `components/similar-perfumes-section.tsx` ->
`getSimilarPerfumesAction`. **Les notes dominent le classement** : +2 par
note en commun (top/heart/base confondus), contre seulement +1 meme marque
et +1 de plus si meme "gamme" probable (`productLine()`, qui retire
concentration/annee du nom pour reperer les flankers d'une meme ligne, ex.
"Sauvage Eau de Parfum" et "Sauvage Elixir" -> "sauvage"), +0.5 si le genre
correspond (ou que l'un des deux est unisexe). Ponderation revisee suite a
un retour explicite : la marque dominait trop le classement au depart (+3
marque vs +1 par note), au point que deux parfums de la meme maison sans
aucune note en commun passaient devant un parfum d'une autre marque tres
proche olfactivement — a l'oppose de l'objectif ("une odeur similaire", pas
"un autre flacon de la meme maison"). Jamais un parfum deja possede par
l'utilisateur (section de decouverte, pas un rappel de la collection), ni
le parfum lui-meme. Section masquee entierement si rien ne depasse un score
de zero — jamais de remplissage avec des resultats sans rapport.

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

**Piege deja corrige (scroll horizontal casse sur mobile)** : la rangee de
`SimilarPerfumesSection` vit toujours a l'interieur du conteneur
`overflow-y-auto` d'une sheet (voir section detail plus bas) — deux zones
de scroll perpendiculaires imbriquees, un cas classique ou le navigateur
mobile capte le swipe pour le scroll vertical du parent au lieu de le
laisser a la rangee horizontale. Corrige en ajoutant explicitement
`touch-action: pan-x` et `overscroll-behavior-x: contain` sur la rangee
(`[touch-action:pan-x] overscroll-x-contain` en classes Tailwind) — dit au
navigateur que cet element gere lui-meme le pan horizontal plutot que de
le remonter au parent. A reappliquer si une future rangee de scroll
horizontal est ajoutee a l'interieur d'une sheet.

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

1. `searchFragranticaCandidatesAction` (dataset `fragrantica_reference`
   uniquement, voir section Scraping) est desormais la **seule** recherche —
   `searchLocalPerfumesAction` (table `perfumes`) a ete retiree, demande
   explicite (une ligne `perfumes` n'a pas forcement d'image, incoherent
   avec le rendu desormais identique de chaque resultat, voir section
   Scraping pour le detail et le risque assume). **Piege deja corrige** :
   sans try/catch autour de l'appel, un echec laissait le spinner
   "Recherche..." tourner indefiniment (ressemblait a "l'app est cassee").
2. `resolvePerfumeAction(url)` : cache hit (`findPerfumeByFragranticaUrl`) ->
   id direct ; sinon `fragrantica_reference` (notes deja connues, pas de
   reseau) -> brouillon **jamais ecrit en base** a ce stade ; si absent des
   deux, `Error("Parfum introuvable")` (plus de scrape live en dernier
   recours, voir section Scraping).
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
   Cloudinary de l'image trouvee — fimgs.net en priorite, voir section
   Scraping — sinon tentative Wikipedia, insertion perfume + notes).
   Consequence assumee : un parfum ajoute par recherche (donc
   `fragranticaUrl !== null`) n'a **pas** de bouton "Modifier" (voir point 7)
   — impossible de lui ajouter un prix apres coup pour l'instant (une photo,
   si — voir "Meme filet pour l'image" dans la section Scraping) ; a rouvrir
   si ca devient genant a l'usage.
4. Si aucun resultat (ni local ni dataset) -> bouton "+ Ajouter un parfum
   manuellement" -> `ManualForm` (nom, marque, image uploadee directement via
   `uploadPerfumeImageAction`, notes en champs texte separes par virgules,
   memes champs prix/contenance/concentration/genre/tags) ->
   `createManualPerfumeAction`. `fragranticaUrl` reste `null` pour ces entrees.
   Le bouton manuel n'est **plus** cache des qu'un resultat existe deja
   (`canAddManually` dans `add-perfume-dialog.tsx`, ex-`noResultsAtAll`) :
   avant, une fois un premier "Paradigme" ajoute manuellement, retaper
   "Paradigme" le trouvait dans les resultats et cachait le bouton manuel,
   empechant d'ajouter une AUTRE variante reelle du meme nom (ex. "Paradigme
   Le Parfum" en EDP a cote du "Paradigme" parfum) — corrige suite a un cas
   reel rencontre par l'utilisateur. `canAddManually` ne depend plus que
   d'une recherche valide et stabilisee (ni trop courte, ni en cours de
   chargement), jamais du nombre de resultats. **Depuis le retrait de la
   recherche locale** (voir section Scraping), ce meme "Paradigme" n'est
   d'ailleurs plus retrouvable du tout en recherche (ni local ni dataset) —
   seul le bouton manuel permet de le recreer, en toute connaissance de
   cause (risque assume, pas re-corrige).
5. Suppression de fond (`lib/remove-background.ts`, `@imgly/background-removal`,
   modele `isnet_quint8`, 100% navigateur/WASM, import dynamique) appliquee
   **directement** sur les images uploadees manuellement (fichier local, pas
   de souci CORS) au moment de l'upload. Les images trouvees automatiquement
   (fimgs.net, Wikipedia, Open Beauty Facts) ne peuvent pas passer par ce
   meme chemin direct (fetch cross-origin fragile/bloque depuis le
   navigateur pour une image tierce non uploadee), mais y passent quand meme
   **en 2 temps apres l'upload initial** cote serveur dans `savePerfumeAction`
   — voir `refineNewPerfumeImage` (`lib/refine-image.ts`) dans la section
   Scraping.
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

**Bouton "+" identique partout** (`components/add-fab.tsx`) : se deploie
toujours en 2 options (ajouter un parfum / creer une nouvelle wishlist),
collection comprise. Une premiere version limitait la collection a un
bouton simple ouvrant direct `AddPerfumeDialog` (un seul choix jugé sensé a
l'epoque) — revenu en arriere suite a un retour explicite, le menu a 2
options est redevenu la version voulue partout.

**Fleches precedent/suivant** de `LibrarySectionView` : entre deux wishlists,
navigation libre dans les deux sens. Depuis la collection
(`/library/collection`, seule route pour la collection — voir plus bas),
uniquement un "next" vers la premiere wishlist — jamais de "prev" (la
collection reste le point de depart). Depuis la
**premiere** wishlist, le "prev" pointe desormais vers la collection
(`app/(app)/library/wishlist/[id]/page.tsx`, `sectionHref(sections[0])`) —
inverse d'une restriction anterieure ("jamais de retour vers la collection
depuis une wishlist") suite a un retour explicite : l'utilisateur veut
pouvoir boucler dans les deux sens. **C'est ce fil collection <-> wishlist1
<-> wishlist2 <-> ... qui fait office de "carrousel"** maintenant que
`/wishlists` a ete retire de la nav (voir plus haut) : la collection
(bouton "Collection" de la nav) reste le point d'entree principal, mais on
peut desormais y revenir depuis n'importe quelle wishlist en remontant la
chaine.

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

**Upload d'image asynchrone dans `ManualForm`** : `handleFile` n'est plus
attendu par le reste du formulaire — il lance la suppression de fond + l'upload
Cloudinary dans une IIFE dont la promesse est stockee dans `uploadPromiseRef`
(pas dans un state), pendant que `name`/`brand`/notes/`meta` restent editables
sans attendre. Seul le bouton "Ajouter" attend potentiellement : `canSubmit` ne
depend plus de `uploading`, et `handleSubmitClick` `await`
`uploadPromiseRef.current` (deja resolue si l'upload est fini, sinon bref
spinner via un state local `waitingForImage` dedie) avant d'appeler `onConfirm`
avec le `imagePublicId` final. Corrige suite a un retour explicite : l'ancien
comportement bloquait le bouton "Ajouter" (donc *semblait* bloquer tout le
formulaire) tant que la photo n'etait pas uploadee.

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
  Cartes compactes en scroll horizontal (pas le grid a vignettes utilise
  ailleurs) avec une image (`ReferencePerfumeThumb`, voir section Scraping —
  construite depuis le CDN `fimgs.net`, jamais verifiee cote affichage, repli
  visuel en cas d'echec rare). Lien "voir
  tout" -> `/discover` (version detaillee, voir plus bas). Puis apercu de
  chaque section (collection d'abord, puis chaque wishlist dans l'ordre de
  `position`), lien "voir tout" vers la page dediee. Bouton "+ Nouvelle
  wishlist" en bas. **Wishlists reordonnables** : `WishlistReorderButtons`
  (`components/wishlist-reorder-buttons.tsx`, fleches haut/bas) affiche a
  cote (jamais dans, un `<button>` imbrique dans le `<a>` de `Link` serait
  invalide) du titre de chaque `SectionPreview` de type wishlist — jamais
  sur la collection, toujours fixee en tete. `moveWishlistAction`
  (`lib/actions/wishlists.ts`) fait un simple echange de `position` avec la
  voisine (pas de renumerotation complete de la liste, suffisant puisque
  `createWishlistAction` incremente toujours depuis le max existant).
- `app/(app)/brands/[brand]/page.tsx` — catalogue complet d'une marque, tire
  du meme dataset local (`getBrandCatalog`, comparaison de marque insensible
  a la casse). Atteinte en tapant le nom de la marque (devenu lien) dans
  `PerfumeDetailSheet`. Vue dediee `components/brand-catalog-view.tsx` (pas
  `LibrarySectionView`, pensee pour des items **possedes** avec notes/tags —
  incompatible avec des lignes du dataset qui n'ont ni l'un ni l'autre) :
  recherche texte + filtre genre en local (pas de tags dans ce dataset).
  Chaque ligne affiche une vignette `ReferencePerfumeThumb` (voir section
  Scraping) a gauche du nom.
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
  section a la fois (`components/library-section-view.tsx`, partage) : le
  bouton "Collection" de la bottom nav pointe directement sur
  `/library/collection` (route `/stats` supprimee — c'etait une deuxieme
  page qui affichait la collection avec un rendu legerement different, un
  reste de l'ancienne page "Statistiques" ; les deux existaient en parallele
  et divergeaient visuellement, source directe du "l'affichage change entre
  collection et wishlist" remonte par l'utilisateur). Desormais un seul
  gabarit fixe pour la collection ET chaque wishlist — chips en haut,
  fleches prev/next, filtres, grille/liste, `AddFab` — seul le contenu
  change (nom, parfums, chiffres des chips) selon `target`, jamais la mise
  en page. **Chips** : toujours 2, calculees directement dans
  `LibrarySectionView` depuis les `items` recus (jamais une prop `aside`
  optionnelle comme avant) — "N parfum(s) possede(s)" + "X€ depenses" pour
  la collection, "N parfum(s)" + "X€ au total" pour une wishlist (somme des
  prix des items de cette liste precise). **Suppression d'une wishlist** :
  bouton poubelle (`DeleteWishlistButton`, dans `library-section-view.tsx`)
  flottant juste au-dessus du FAB "+", visible uniquement quand
  `target.kind === "wishlist"` (jamais sur la collection, qui ne se
  supprime pas) — `confirm()` natif puis `deleteWishlistAction`, puis
  redirection vers `/library/collection` (seul endroit stable une fois la
  wishlist courante disparue). Navigation prev/next libre entre wishlists,
  et la premiere wishlist boucle vers la collection via son "prev" (voir
  section Flow d'ajout plus haut pour le detail) ; la collection elle-meme
  n'a pas de prev, et son next pointe vers la premiere wishlist. **C'est ce
  carrousel prev/next qui sert de seul chemin vers les wishlists** —
  `app/(app)/wishlists/page.tsx` (redirection vers la premiere wishlist,
  ex-cible du bouton "coeur") a ete supprime : redondant, la nav
  "Collection" y menait deja via le "next".
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
- `app/(app)/admin/feedback/page.tsx` — liste complete des avis envoyes
  (`listAllFeedbackAction`), reservee au compte admin. Voir section Admin
  ci-dessous.

## Admin (compte unique, code en dur)

Pas de colonne `role` sur `user` : un seul admin sur ce projet perso, une
vraie gestion de roles serait de la complexite pour un gain nul a cette
echelle. `lib/admin.ts` exporte `isAdminEmail(email)`, qui compare a une
constante `amineakh2004@gmail.com` codee en dur (l'email du proprietaire du
projet). Si ce compte change un jour, modifier cette seule constante.

- `components/app-top-bar.tsx` (`AppTopBar`) est devenu un composant async
  (`requireUser()` + `isAdminEmail()`) : le slot vide a gauche (oppose au
  toggle theme a droite, voir section UI) affiche une cloche
  (`lucide-react` `Bell`) uniquement pour l'admin, avec un badge rond
  affichant le nombre total d'avis (`getFeedbackCountAction`,
  `lib/actions/feedback.ts` — requete `count(*)` dediee, plus legere qu'un
  `listAllFeedbackAction` complet vu que ce composant est rendu sur
  **chaque** page). Lien vers `/admin/feedback`.
- `app/(app)/admin/feedback/page.tsx` : `notFound()` (pas une redirection)
  si l'utilisateur connecte n'est pas l'admin — pour ne pas laisser deviner
  que la route existe. Liste tous les avis (`listAllFeedbackAction`, tri
  `createdAt` desc), username/email/date/message par entree, via
  `components/admin-feedback-list.tsx` (client, boutons Archiver/Restaurer
  + Supprimer par entree).
- `listAllFeedbackAction`/`getFeedbackCountAction`/`setFeedbackArchivedAction`/
  `deleteFeedbackAction` (`lib/actions/feedback.ts`) verifient toutes
  `isAdminEmail` cote serveur (jamais uniquement cote UI, factorise dans un
  `requireAdmin()` local au fichier) — meme reflexe de securite que le reste
  de l'app : ne jamais faire confiance a l'affichage conditionnel seul pour
  proteger une donnee. **Archiver vs supprimer** : archiver (`archived: true`)
  masque l'avis du badge de la cloche (`getFeedbackCountAction` ne compte que
  `archived = false`) mais le garde consultable dans une section "Archives"
  en bas de la page admin, reversible via "Restaurer" ; supprimer
  (`deleteFeedbackAction`) est un `DELETE` definitif, confirme cote client
  par un `confirm()` natif (meme convention que la suppression de compte,
  section Profil).

## UI / conventions a respecter

- **Coque responsive** : mobile-first (`max-w-md`), mais plus figee a cette
  seule largeur — la coque s'elargit par palier sur tablette/PC (`sm:max-w-2xl
  lg:max-w-4xl`, breakpoints Tailwind par defaut : `sm` 640px, `lg` 1024px).
  **Un seul et meme triplet de classes** `max-w-md sm:max-w-2xl lg:max-w-4xl`
  est repete a l'identique partout ou la largeur de la coque compte : le
  layout `(app)/layout.tsx` (leve automatiquement la largeur de `<main>` et
  de toutes les pages qu'il contient), et separement `AppTopBar` et
  `BottomNav` (leur propre wrapper interne `mx-auto`, necessaire car ce sont
  des elements `fixed` — la largeur de leur parent DOM ne les contraint pas,
  `position: fixed` se positionne par rapport au viewport, pas au parent).
  Si ce triplet doit changer, le mettre a jour aux 3 endroits. **Pas de
  sidebar ni de nav desktop dediee** : la bottom nav reste utilisee a toutes
  les tailles (deliberement, pour ne pas dupliquer la logique de navigation
  sur un second paradigme d'UI — coherent avec le reste du projet).
  Consequence directe sur les elements `fixed` positionnes par rapport au
  bord de l'ecran (`AddFab`, `DeleteWishlistButton`) : `right-4` seul ne
  suffit plus, puisque la coque n'occupe plus tout le viewport sur
  tablette/PC — voir plus bas.
- **Elements `fixed` ancres a la coque, pas au viewport** : `AddFab`
  (`components/add-fab.tsx`, ses deux variantes) et `DeleteWishlistButton`
  (`components/library-section-view.tsx`) utilisent le meme patron : une
  bande `fixed inset-x-0` pleine largeur (a la bonne hauteur, `pointer-events-none`
  pour ne pas bloquer les clics sur le vide de part et d'autre sur grand
  ecran), contenant une colonne `mx-auto w-full max-w-md sm:max-w-2xl
  lg:max-w-4xl` (le meme triplet que la coque) avec `justify-end` et
  `pointer-events-auto` sur le bouton lui-meme. Le bouton reste ainsi
  toujours cale sur le bord droit de la coque, jamais sur celui du viewport —
  sans ca, sur un grand ecran, le bouton se serait retrouve tres loin a
  droite du contenu reellement affiche (centre, coque etroite au milieu d'un
  large ecran). A reappliquer pour tout futur element `fixed` positionne par
  rapport a un bord d'ecran.
- **Sheets bas (`components/ui/sheet.tsx`, `data-[side=bottom]`)** : sans
  largeur max native (`inset-x-0` seul, contrairement aux sheets lateraux qui
  ont deja `sm:max-w-sm`), une sheet du bas s'etirerait bord a bord sur tout
  le viewport en tablette/PC — incoherent avec le reste de la coque, qui
  reste centree. Corrige directement dans le composant partage (pas par
  appel) : a partir de `sm`, `inset-x-auto` + `left-1/2` + `-translate-x-1/2`
  + `w-full max-w-2xl` (`lg:max-w-4xl`) recentre la sheet en gardant le meme
  triplet de largeurs que le reste de l'app, avec des bordures laterales
  (`sm:border-x`) puisqu'elle ne touche plus les bords de l'ecran.
- **Grilles de parfums** : `grid-cols-3` (collection/wishlist, skeleton de
  chargement) et `grid-cols-2` (apercus accueil, Decouvrir, filtres) gagnent
  des colonnes en plus par palier (`sm:`/`lg:`) plutot que de rester figes —
  ex. `grid-cols-3 sm:grid-cols-4 lg:grid-cols-5` pour la grille principale.
  Pas de logique commune extraite (pas de constante partagee) : chaque grille
  a son propre nombre d'elements a afficher et son propre bon nombre de
  colonnes cible, l'usine a gaz d'une config centralisee n'apporterait rien
  ici.
- **AppTopBar vs BrandHeader** : ce sont deux composants distincts qui font un
  logo similaire mais dans des contextes differents. `AppTopBar`
  (`components/app-top-bar.tsx`) = persistant sur toutes les pages `(app)`,
  flottant, sans fond ni bordure (demande explicite : pas de "barre" visible,
  juste le logo+tagline+toggle qui flottent sur le fond de la page). Grid a 3
  colonnes : slot gauche (cloche admin si applicable, sinon vide, voir
  section Admin), logo+tagline au centre, toggle theme a droite.
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
- Dans un script SQL brut (`@libsql/client`) touchant `perfumes.fragranticaUrl`,
  ne pas ecrire `fragrantica_url` : cette colonne precise est nommee
  `"fragranticaUrl"` (camelCase, entre guillemets) contrairement a
  `fragrantica_reference.fragrantica_url` (snake_case) — incoherence
  historique entre les deux tables, invisible via Drizzle (qui utilise
  toujours la propriete TS `fragranticaUrl`) mais source d'un
  `SQL_INPUT_ERROR` immediat en SQL brut.
