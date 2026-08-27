import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Renomme de middleware.ts a proxy.ts en Next.js 16. Verification optimiste
// (presence du cookie de session uniquement, pas de requete DB ici) : les
// routes serveur re-verifient la vraie session avant toute lecture/ecriture.
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
