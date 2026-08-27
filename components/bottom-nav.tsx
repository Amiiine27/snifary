"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lightbulb, BarChart3, Home, Heart, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/feedback", icon: Lightbulb, label: "Avis", match: (p: string) => p.startsWith("/feedback") },
  { href: "/stats", icon: BarChart3, label: "Stats", match: (p: string) => p.startsWith("/stats") },
  { href: "/", icon: Home, label: "Accueil", match: (p: string) => p === "/" },
  {
    href: "/wishlists",
    icon: Heart,
    label: "Wishlists",
    match: (p: string) => p.startsWith("/wishlists") || p.startsWith("/library/wishlist"),
  },
  { href: "/profile", icon: User, label: "Profil", match: (p: string) => p.startsWith("/profile") },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-popover/95 backdrop-blur supports-backdrop-filter:bg-popover/80">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {items.map(({ href, icon: Icon, label, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-xs transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-6" strokeWidth={active ? 2.25 : 1.75} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
