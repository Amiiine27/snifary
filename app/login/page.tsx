"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Tagline } from "@/components/tagline";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    await signIn.social({ provider: "google", callbackURL: "/" });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-8 text-center">
      <div className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight">Snifary</h1>
        <Tagline className="text-muted-foreground" />
      </div>

      <Button size="lg" className="w-full max-w-xs" onClick={handleGoogleSignIn} disabled={loading}>
        {loading ? "Connexion..." : "Continuer avec Google"}
      </Button>
    </div>
  );
}
