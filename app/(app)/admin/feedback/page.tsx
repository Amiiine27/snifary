import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin";
import { listAllFeedbackAction } from "@/lib/actions/feedback";
import { AdminFeedbackList } from "@/components/admin-feedback-list";

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

      <AdminFeedbackList entries={entries} />
    </div>
  );
}
