import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, primaryKey, check, unique } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Tables Better Auth (user, session, account, verification) : voir
// auth-schema.ts. On les importe ici pour que Drizzle connaisse les FK vers
// user.id, mais on ne les modifie jamais a la main hors de ce fichier dedie.
// ---------------------------------------------------------------------------
export * from "./auth-schema";
import { user } from "./auth-schema";

// ---------------------------------------------------------------------------
// perfumes : catalogue partage, resultat du scraping Fragrantica, jamais
// duplique par utilisateur. Un seul row par parfum, peu importe combien
// d'utilisateurs l'ont dans leur collection/wishlist.
// ---------------------------------------------------------------------------
export const perfumes = sqliteTable(
  "perfumes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    brand: text("brand").notNull(),
    imagePublicId: text("image_public_id"), // Cloudinary public_id uniquement, jamais l'URL
    fragranticaUrl: text("fragranticaUrl"),
    // Non-null = c'est un "clone"/dupe, precise de quel parfum original il s'inspire.
    inspiredBy: text("inspired_by"),
    price: real("price"), // prix en euros, nullable (pas toujours connu)
    volumeMl: integer("volume_ml").notNull().default(100), // contenance, 100ml par defaut
    concentration: text("concentration", {
      enum: ["edt", "edp", "parfum", "extrait", "cologne"],
    }),
    gender: text("gender", { enum: ["homme", "femme", "unisexe"] }).notNull().default("unisexe"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    check(
      "perfumes_concentration_check",
      sql`${table.concentration} IN ('edt', 'edp', 'parfum', 'extrait', 'cologne')`
    ),
    check("perfumes_gender_check", sql`${table.gender} IN ('homme', 'femme', 'unisexe')`),
  ]
);

// ---------------------------------------------------------------------------
// notes : referentiel des notes olfactives (bergamote, vanille, ...), chaque
// note n'existe qu'une seule fois pour permettre le filtrage transverse.
// ---------------------------------------------------------------------------
export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

// ---------------------------------------------------------------------------
// perfume_notes : pivot parfum <-> note, avec la position dans la pyramide
// olfactive (tete/coeur/fond). PK composite pour interdire les doublons.
// ---------------------------------------------------------------------------
export const perfumeNotes = sqliteTable(
  "perfume_notes",
  {
    perfumeId: integer("perfume_id")
      .notNull()
      .references(() => perfumes.id, { onDelete: "cascade" }),
    noteId: integer("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["top", "heart", "base"] }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.perfumeId, table.noteId, table.type] }),
    check("perfume_notes_type_check", sql`${table.type} IN ('top', 'heart', 'base')`),
  ]
);

// ---------------------------------------------------------------------------
// perfume_tags : pivot parfum <-> categorie (saison / moment de la journee).
// Un parfum peut porter plusieurs tags (ex: ete + nuit), d'ou la table dediee
// plutot qu'une colonne unique - meme logique que les notes.
// ---------------------------------------------------------------------------
export const perfumeTags = sqliteTable(
  "perfume_tags",
  {
    perfumeId: integer("perfume_id")
      .notNull()
      .references(() => perfumes.id, { onDelete: "cascade" }),
    tag: text("tag", {
      enum: ["printemps", "ete", "automne", "hiver", "jour", "nuit"],
    }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.perfumeId, table.tag] }),
    check(
      "perfume_tags_tag_check",
      sql`${table.tag} IN ('printemps', 'ete', 'automne', 'hiver', 'jour', 'nuit')`
    ),
  ]
);

// ---------------------------------------------------------------------------
// collection_items : les parfums que l'utilisateur POSSEDE. Une seule
// collection par utilisateur (pas de sous-listes ici, contrairement aux
// wishlists).
// ---------------------------------------------------------------------------
export const collectionItems = sqliteTable(
  "collection_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    perfumeId: integer("perfume_id")
      .notNull()
      .references(() => perfumes.id, { onDelete: "cascade" }),
    personalNote: text("personal_note"),
    addedAt: integer("added_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [unique().on(table.userId, table.perfumeId)]
);

// ---------------------------------------------------------------------------
// wishlists : listes de souhaits nommees par l'utilisateur (ex: "A acheter",
// "Idees cadeaux"). Sur le home, la collection s'affiche en premier, puis
// chaque wishlist devient sa propre section, dans l'ordre de `position`.
// ---------------------------------------------------------------------------
export const wishlists = sqliteTable("wishlists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ---------------------------------------------------------------------------
// wishlist_items : pivot wishlist <-> parfum.
// ---------------------------------------------------------------------------
export const wishlistItems = sqliteTable(
  "wishlist_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    wishlistId: integer("wishlist_id")
      .notNull()
      .references(() => wishlists.id, { onDelete: "cascade" }),
    perfumeId: integer("perfume_id")
      .notNull()
      .references(() => perfumes.id, { onDelete: "cascade" }),
    addedAt: integer("added_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [unique().on(table.wishlistId, table.perfumeId)]
);

// ---------------------------------------------------------------------------
// feedback : "Ton avis compte". On fige username/email au moment de l'envoi
// (snapshot) pour garder une trace lisible meme si le profil change ensuite.
// ---------------------------------------------------------------------------
export const feedback = sqliteTable(
  "feedback",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    email: text("email").notNull(),
    message: text("message").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [check("feedback_message_min_length", sql`length(${table.message}) >= 20`)]
);
