# Handoff — Bibliothèque à Parfums (projet perso)

> Document de contexte complet pour Claude Code. Lire en entier avant de commencer. Aucune ligne de code ne doit être écrite sans validation explicite de chaque étape (voir section Méthodologie).

---

## 1. Profil du développeur

**Expérience technique :**
- Bases solides en Java (POO, MVC, JPA/Hibernate, Spring Boot, Spring Security)
- React : hooks (useState, useEffect, useContext, useCallback), gestion d'état, composants fonctionnels
- Next.js App Router (TypeScript strict) : Server Components, Client Components, route handlers, middleware
- AngularJS : directives, $scope, vm pattern
- Kotlin + Spring Boot : API REST, CORS
- Docker : notions solides (Dockerfile, volumes, port mapping), pas encore en prod
- n8n self-hosted, webhooks

**Niveau :** confirmé sur le stack ci-dessous, veut comprendre chaque décision, pas juste copier du code généré.

---

## 2. Stack technique imposée

| Brique | Techno | Notes |
|---|---|---|
| Framework | Next.js 16 App Router | TypeScript strict obligatoire |
| Styles | Tailwind CSS v4 | |
| UI Kit | shadcn/ui | preset **Nova** |
| Base de données | Turso (SQLite edge) | |
| ORM | Drizzle ORM | |
| Auth | Better Auth | génère automatiquement les tables `user`, `session`, `account`, `verification` |
| Animations | Motion (ex Framer Motion) | |
| Images | Cloudinary | **stocker uniquement le `public_id`, jamais l'URL complète** (portabilité future vers R2 ou autre) |
| Déploiement | Vercel (free tier) | CD automatique sur push `main` |
| Scraping | cheerio (pas de headless browser, Fragrantica ne fait pas de rendu JS côté notes/images) | |

**Environnement dev :**
- Windows, terminal **PowerShell**
- Toute commande `drizzle-kit` doit être préfixée ainsi :
  ```powershell
  npx dotenv-cli -e .env.local -- npx drizzle-kit push
  ```

**Git workflow :**
- Une branche par module/feature
- Préfixes de commit : `feat`, `fix`, `chore`, `refactor`, `style`
- Squash merge vers `main`

---

## 3. Méthodologie de travail (IMPORTANT — à respecter strictement)

1. **Une étape à la fois.** Ne jamais enchaîner sur l'étape suivante sans validation explicite de l'utilisateur.
2. **Expliquer avant de coder.** Pour chaque fichier/feature : pourquoi cette approche, quel concept Next.js/React/Drizzle est en jeu, quel cas d'usage concret.
3. **Squelette d'abord.** Donner la structure du fichier avec des `TODO` à compléter, pas le code complet — sauf demande explicite contraire.
4. **Découpage en parties numérotées.** Un fichier complexe se découpe en `Part 1`, `Part 2a`, `Part 2b`, etc., codées une par une.
5. **Commentaires pédagogiques dans le code.** Chaque explication donnée en discussion doit AUSSI apparaître en commentaire dans le code (en haut du fichier + inline aux endroits pertinents).
6. **Zéro over-engineering.** Toujours la solution la plus simple qui fonctionne pour l'échelle du projet (perso, quelques utilisateurs).
7. **Une question de clarification à la fois** si besoin, jamais plusieurs en même temps.
8. **Ton direct, concis, en français.** Pas de pavés inutiles.

---

## 4. Le projet : Bibliothèque à Parfums

### Concept
Une web app multi-utilisateurs où chacun gère sa propre bibliothèque de parfums : ce qu'il **possède** (Owned) et ce qu'il **souhaite acheter** (Wishlist). L'utilisateur tape le nom d'un parfum, l'app va chercher les infos (image, marque, notes olfactives) et les propose à l'ajout dans sa collection perso.

### Fonctionnalités cœur
- Compte utilisateur (Better Auth) → chaque user a sa bibliothèque privée
- Recherche d'un parfum par nom → scraping à la demande de Fragrantica
- Résultat scrapé mis en cache dans Turso (jamais re-scrapé si déjà en base)
- Ajout à la collection perso avec statut `owned` ou `wishlist`
- Fiche parfum : image, marque, pyramide olfactive (top/heart/base notes), note personnelle libre
- Vue collection perso filtrable par statut

### Ce qui est explicitement HORS SCOPE (éviter l'over-engineering)
- Pas de système de notation communautaire façon Fragrantica
- Pas de reviews/commentaires
- Pas de scraping massif préalable de tout un catalogue — uniquement à la demande, un parfum à la fois
- Pas de recherche full-text avancée pour la V1

---

## 5. Source des données parfums — décision actée

**Approche : scraping à la demande + cache Turso.**

Flow :
1. User tape un nom dans un champ de recherche
2. Un **route handler** Next.js (`/api/search-perfume` ou équivalent) reçoit la requête
3. Le handler vérifie D'ABORD si le parfum existe déjà dans la table `perfumes` (cache)
4. Si absent : scraping serveur-side de Fragrantica via `cheerio` (jamais côté client — CORS + ToS)
5. Extraction : nom, marque, image, notes top/heart/base
6. L'utilisateur valide le bon résultat → écriture en base (uniquement à ce moment, pas de stockage spéculatif)
7. Image : upload vers Cloudinary, on stocke le `public_id` retourné (jamais l'URL Cloudinary ni l'URL Fragrantica de l'image)

**Point d'attention légal (à mentionner à l'utilisateur si le sujet revient) :** scraper Fragrantica pour un usage personnel non commercial est une zone grise mais couramment pratiqué (des projets open source comme PerfumAPI font pareil, à but éducatif/test). Pas d'usage commercial de cette donnée.

---

## 6. Schéma de base de données — VALIDÉ, à implémenter tel quel

### Décisions de conception actées avec l'utilisateur :

- **IDs : `integer` auto-incrémenté** pour toutes les tables métier (pas d'UUID). Justification : pas de risque d'énumération car toute requête est filtrée par `userId` de session — l'UUID ajouterait de la complexité sans bénéfice de sécurité réel ici.
  - Exception : `userId` dans `collection_items` est en `text`, car Better Auth génère des IDs texte (cuid) pour sa table `user` — le type du FK doit matcher.
- **Timestamps : `integer` en mode `timestamp` (Unix epoch)**, via Drizzle `{ mode: 'timestamp' }`, valeur par défaut `sql\`(unixepoch())\``.
- **Enums (type de note, statut collection) : `text` + CHECK constraint SQLite natif**, PAS un enum TypeScript seul. Justification actée : la contrainte DB protège même en cas de bug applicatif ou requête SQL manuelle — l'enum TS seul ne protège qu'à la compilation. On garde un type TypeScript en plus pour l'autocomplétion (complémentaire, pas exclusif).
- **Notes olfactives : table dédiée `notes` + table pivot `perfume_notes`** (pas de JSON/texte libre dans `perfumes`), pour permettre plus tard le filtrage ("tous mes parfums avec vanille").

### Tables

**`perfumes`** — catalogue partagé (cache du scraping), jamais dupliqué par utilisateur
```
id              integer, PK, autoincrement
name            text, not null
brand           text, not null
imagePublicId   text, nullable (Cloudinary public_id, jamais l'URL complète)
fragranticaUrl  text, nullable (pour retrouver la source / re-scraper si besoin)
createdAt       integer (timestamp unix), not null, default now
```

**`notes`** — référentiel des notes olfactives, chaque note existe une seule fois
```
id      integer, PK, autoincrement
name    text, not null, unique (ex: "bergamote", "vanille")
```

**`perfume_notes`** — pivot perfume <-> note, AVEC l'attribut `type`
```
perfumeId   integer, FK -> perfumes.id
noteId      integer, FK -> notes.id
type        text, not null, CHECK (type IN ('top', 'heart', 'base'))
-- PK composite (perfumeId, noteId, type)
```

**`collection_items`** — pivot user <-> perfume, la bibliothèque perso de chaque utilisateur
```
id              integer, PK, autoincrement
userId          text, FK -> user.id (table Better Auth, ne pas recréer)
perfumeId       integer, FK -> perfumes.id
status          text, not null, CHECK (status IN ('owned', 'wishlist'))
addedAt         integer (timestamp unix), not null, default now
personalNote    text, nullable (note libre de l'utilisateur)
```

**Tables Better Auth** (générées automatiquement via sa CLI, ne pas recréer manuellement) : `user`, `session`, `account`, `verification`.

---

## 7. Progression déjà faite avant ce handoff

- Stack et conventions posées et validées avec l'utilisateur (voir sections 2, 3)
- Réflexion sur la source de données actée : scraping à la demande + cache Turso (section 5)
- Schéma de base de données entièrement conçu et validé conceptuellement (section 6) — **le code du schéma Drizzle n'a PAS encore été écrit**, on en était à expliquer le concept de `sqliteTable()` et le squelette de la table `perfumes` (Part 1) avec des `TODO` à compléter par l'utilisateur lui-même en mode pédagogique.

## 8. Prochaine étape

Écrire le fichier `db/schema.ts` complet, partie par partie (Part 1 : `perfumes`, Part 2 : `notes`, Part 3 : `perfume_notes`, Part 4 : `collection_items`), en respectant strictement la méthodologie de la section 3 : explication du concept avant chaque partie, squelette avec TODO, validation utilisateur avant de passer à la partie suivante.

Ne pas avancer au-delà du schéma (pas de route handlers, pas d'UI) tant que le schéma n'est pas validé et migré.
