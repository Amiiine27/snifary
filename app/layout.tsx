import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Rowdies } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Police display (logo "Snifary", titres) : pas d'italique disponible, 3 graisses seulement.
const rowdies = Rowdies({
  variable: "--font-rowdies",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

export const metadata: Metadata = {
  title: "Snifary",
  description: "Ta bibliotheque de parfums personnelle",
  icons: {
    icon: ["/icon-192.png", "/icon-512.png"],
    apple: "/apple-icon.png",
  },
  // "Ajouter a l'ecran d'accueil" en plein ecran, sans chrome Safari.
  appleWebApp: {
    capable: true,
    title: "Snifary",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#c9b896" },
    { media: "(prefers-color-scheme: dark)", color: "#2f1a2e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${rowdies.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
