import { notFound } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { requireUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";
import { listAllFeedbackAction } from "@/lib/actions/feedback";

// Reserve au compte admin (voir lib/admin.ts) -- notFound() plutot qu'une
// redirection pour ne pas laisser deviner que la route existe.
export default async function AdminFeedbackPage() {
  const user = await requireUser();
  if (!isAdminEmail(user.email)) notFound();

  const entries = await listAllFeedbackAction();

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <div>
        <h1 className="font-heading text-xl">Avis recus</h1>
        <p className="text-sm text-muted-foreground">
          {entries.length} {entries.length > 1 ? "messages" : "message"}
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          Aucun avis pour l&apos;instant
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{entry.username}</p>
                  <p className="truncate text-xs text-muted-foreground">{entry.email}</p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {entry.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <p className="flex items-start gap-1.5 text-sm">
                <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="whitespace-pre-wrap">{entry.message}</span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
