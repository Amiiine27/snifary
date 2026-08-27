import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/auth-schema";

// Instance serveur de Better Auth. Seul moyen de connexion prevu pour l'instant :
// Google. `nextCookies()` doit rester le dernier plugin de la liste (regle
// Better Auth) : il synchronise les cookies de session avec l'API cookies()
// de Next.js dans les Server Actions.
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  user: {
    // Pas de mot de passe (Google only) : suppression immediate, sans email de confirmation.
    deleteUser: { enabled: true },
  },
  plugins: [nextCookies()],
});
