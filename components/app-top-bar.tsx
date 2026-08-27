import Link from "next/link";
import { Bell } from "lucide-react";
import { ThemeToggleButton } from "@/components/theme-toggle";
import { Tagline } from "@/components/tagline";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";
import { getFeedbackCountAction } from "@/lib/actions/feedback";

// Persistant sur toutes les pages (comme BottomNav mais en haut), mais sans
// bandeau : flotte directement sur le fond de la page, pas de barre coloree
// ni de ligne de separation. Slot de gauche : vide pour tout le monde, sauf
// pour le compte admin (cloche vers les avis recus) -- symetrique avec le
// toggle theme a droite.
export async function AppTopBar() {
  const user = await requireUser();
  const admin = isAdminEmail(user.email);
  const feedbackCount = admin ? await getFeedbackCountAction() : 0;

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto grid max-w-md grid-cols-[2.5rem_1fr_2.5rem] items-start gap-2 px-3 pt-4">
        {admin ? (
          <Link
            href="/admin/feedback"
            aria-label="Avis recus"
            className={cn(buttonVariants({ variant: "outline", size: "icon" }), "relative rounded-full")}
          >
            <Bell />
            {feedbackCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {feedbackCount > 9 ? "9+" : feedbackCount}
              </span>
            )}
          </Link>
        ) : (
          <div />
        )}
        <div className="text-center">
          <h1 className="font-heading text-xl">Snifary</h1>
          <Tagline className="mt-0.5 text-xs text-muted-foreground" />
        </div>
        <ThemeToggleButton />
      </div>
    </header>
  );
}
