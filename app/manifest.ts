import type { MetadataRoute } from "next";

// Permet le "Ajouter a l'ecran d'accueil" en mode standalone (sans barre
// d'adresse du navigateur), comme une vraie app installee.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Snifary",
    short_name: "Snifary",
    description: "Ta bibliotheque de parfums personnelle",
    start_url: "/",
    display: "standalone",
    background_color: "#2f1a2e",
    theme_color: "#2f1a2e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
