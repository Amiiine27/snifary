"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Disponible en tout temps (monte dans le layout racine, hors du groupe
// (app)) donc visible aussi bien sur /login que sur le reste de l'app.
export function ThemeToggle() {
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
      className="fixed right-4 top-4 z-50 rounded-full"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Basculer le theme clair/sombre"
    >
      {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
