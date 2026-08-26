import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"; 

// Exemple de table de depart, a adapter/supprimer selon le projet 
export const exampleTable = sqliteTable("example", { 
  id: integer("id").primaryKey({ autoIncrement: true }), 
  name: text("name").notNull(), 
}); 
