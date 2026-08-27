"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lightbulb, Library, Home, Compass, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/feedback", icon: Lightbulb, label: "Avis", match: (p: string) => p.startsWith("/feedback") },
  { href: "/library/collection", icon: Library, label: "Collection", match: (p: string) => p.startsWith("/library") },
  { href: "/", icon: Home, label: "Accueil", match: (p: string) => p === "/" },
  { href: "/discover", icon: Compass, label: "Decouvrir", match: (p: string) => p.startsWith("/discover") },
  { href: "/profile", icon: User, label: "Profil", match: (p: string) => p.startsWith("/profile") },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-popover/95 backdrop-blur supports-backdrop-filter:bg-popover/80">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 sm:max-w-2xl lg:max-w-4xl">
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
