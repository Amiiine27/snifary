"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Bouton nu, reutilisable en ligne (dans BrandHeader) ou flottant (voir
// GlobalThemeToggle plus bas).
export function ThemeToggleButton({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- le theme resolu depend du systeme, seulement connu apres montage
    setMounted(true);
  }, []);

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn("rounded-full", className)}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Basculer le theme clair/sombre"
    >
      {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}

// Pages qui integrent deja le toggle dans leur propre en-tete (BrandHeader) :
// pas besoin du bouton flottant en plus, ce serait en double.
const PAGES_WITH_OWN_TOGGLE = ["/login", "/", "/profile", "/feedback"];

export function GlobalThemeToggle() {
  const pathname = usePathname();
  if (PAGES_WITH_OWN_TOGGLE.includes(pathname)) return null;

  return <ThemeToggleButton className="fixed right-4 top-4 z-50" />;
}
