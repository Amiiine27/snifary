"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { BrandHeader } from "@/components/brand-header";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    await signIn.social({ provider: "google", callbackURL: "/" });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-8">
      <div className="w-full max-w-xs">
        <BrandHeader tagline />
      </div>

      <Button size="lg" className="h-12 w-full max-w-xs text-base" onClick={handleGoogleSignIn} disabled={loading}>
        {loading ? "Connexion..." : "Continuer avec Google"}
      </Button>
    </div>
  );
}
