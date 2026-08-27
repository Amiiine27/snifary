"use client";

import { createAuthClient } from "better-auth/react";

// Client auth cote navigateur : expose les hooks React (useSession, etc.)
// et les actions (signIn, signOut). Pas de baseURL a fournir en dev, Better
// Auth deduit l'origine courante.
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
