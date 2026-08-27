import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// A utiliser dans les Server Components / route handlers pour recuperer
// l'utilisateur connecte. Le proxy (proxy.ts) fait deja une verification
// optimiste sur toutes les routes protegees, donc ici on peut considerer
// qu'une session absente est une erreur de programmation, pas un cas
// utilisateur normal a gerer avec un ecran dedie.
export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Session absente alors que la route est censee etre protegee");
  return session.user;
}
