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
   `searchFragranticaCandidatesAction` (DuckDuckGo, plus lent) tournent en
   **parallele independant** cote UI (deux `useEffect` separes) : le cache
   local s'affiche tout de suite, un echec/lenteur reseau sur le second
   n'affecte jamais le premier. **Piege deja corrige** : sans try/catch autour
   de l'appel, un echec reseau laissait le spinner "Recherche..." tourner
   indefiniment (ressemblait a "l'app est cassee").
2. `resolvePerfumeAction(url)` : cache hit (`findPerfumeByFragranticaUrl`) ->
   id direct, sinon scrape -> brouillon **jamais ecrit en base** a ce stade.
3. L'utilisateur confirme/corrige (prix, contenance, concentration, genre,
   tags) -> `savePerfumeAction` est le **seul moment d'ecriture** (upload
   Cloudinary de l'image Fragrantica via `uploadImageFromUrl`, insertion
   perfume + notes + tags).
4. Si aucun resultat (ni local ni Fragrantica) -> bouton "+ Ajouter un parfum
   manuellement" -> `ManualForm` (nom, marque, image uploadee directement via
   `uploadPerfumeImageAction`, notes en champs texte separes par virgules,
   memes champs prix/contenance/concentration/genre/tags) ->
   `createManualPerfumeAction`. `fragranticaUrl` reste `null` pour ces entrees.
5. Suppression de fond (`lib/remove-background.ts`, `@imgly/background-removal`,
   modele `isnet_quint8`, 100% navigateur/WASM, import dynamique) appliquee
   **uniquement sur les images uploadees manuellement** (fichier local, pas de
   souci CORS). Les images scrapees depuis Fragrantica ne passent PAS par ce
   traitement (le fetch cross-origin de leur CDN depuis le navigateur serait
   fragile) — extension possible plus tard en ajoutant un choix d'image
   optionnel dans l'etape de confirmation d'un brouillon scrape.
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
depuis cet ecran. Meme logique pour les fleches precedent/suivant de
`LibrarySectionView` : elles n'existent que pour `target.kind === "wishlist"`
(navigation entre wishlists entre elles) — la collection n'a jamais de fleches,
demande explicite pour ne pas suggerer un lien navigable vers les wishlists
depuis la collection.

## Navigation / structure des pages

- `app/login/page.tsx` — hors du groupe `(app)`, seule page publique (avec
  `/api/auth/*` et les assets PWA). Sa propre mise en page centree +
  `BrandHeader` (logo + tagline + toggle, style "splash").
- `app/(app)/layout.tsx` — coque partagee par toutes les pages connectees :
  `AppTopBar` (fixe en haut, flottant SANS fond/bordure — logo "Snifary" +
  tagline aleatoire + toggle theme, cf section UI) et `BottomNav` (fixe en
  bas, 5 icones : Avis/Collection/Accueil/Wishlists/Profil).
- `app/(app)/page.tsx` (Accueil) — apercu de chaque section (collection
  d'abord, puis chaque wishlist dans l'ordre de `position`), lien "voir tout"
  vers la page dediee. Bouton "+ Nouvelle wishlist" en bas.
- `app/(app)/library/collection/page.tsx` et
  `app/(app)/library/wishlist/[id]/page.tsx` — vue complete d'**une seule**
  section a la fois (`components/library-section-view.tsx`, partage) :
  grille/liste, modal de filtres, `AddFab`. Navigation prev/next **limitee aux
  wishlists entre elles** (la collection n'est jamais accessible depuis une
  wishlist par ces fleches, demande explicite) ; la collection n'a pas de
  prev, et son next pointe vers la premiere wishlist.
- `app/(app)/wishlists/page.tsx` — pas de contenu propre, redirige vers la
  premiere wishlist existante (ou la collection si aucune n'existe encore).
  Cible du bouton "coeur" de la bottom nav.
- `app/(app)/stats/page.tsx` — cible du bouton "Collection"/bibliotheque de la
  bottom nav (route `/stats` conservee, label change). Affiche une ligne
  discrete "N parfums possedes · X€ depenses" (`aside` prop de
  `LibrarySectionView`) **au-dessus** de la collection complete (meme
  composant que `/library/collection`) — pas de gros chiffres en carte, la
  collection reste le contenu principal de cette page.
- `app/(app)/profile/page.tsx` — avatar (upload/recadrage/suppression via
  `components/avatar-uploader.tsx` + `avatar-crop-dialog.tsx`,
  `react-easy-crop`), nom modifiable, deconnexion, suppression de compte.
- `app/(app)/feedback/page.tsx` — formulaire, bouton actif a partir de 20
  caracteres (doublee par le CHECK SQL).

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
