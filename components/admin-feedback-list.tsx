"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, MessageSquare, Trash2 } from "lucide-react";
import { setFeedbackArchivedAction, deleteFeedbackAction } from "@/lib/actions/feedback";
import { Button } from "@/components/ui/button";

type FeedbackEntry = {
  id: number;
  username: string;
  email: string;
  message: string;
  archived: boolean;
  createdAt: Date;
};

export function AdminFeedbackList({ entries }: { entries: FeedbackEntry[] }) {
  const active = entries.filter((e) => !e.archived);
  const archived = entries.filter((e) => e.archived);

  return (
    <div className="flex flex-col gap-6">
      {active.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          Aucun avis en attente
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((entry) => (
            <FeedbackRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Archives ({archived.length})
          </p>
          {archived.map((entry) => (
            <FeedbackRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackRow({ entry }: { entry: FeedbackEntry }) {
  const [pending, startTransition] = useTransition();

  function toggleArchived() {
    startTransition(async () => {
      try {
        await setFeedbackArchivedAction(entry.id, !entry.archived);
      } catch {
        toast.error("Impossible de mettre a jour cet avis");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Supprimer definitivement cet avis ?")) return;
    startTransition(async () => {
      try {
        await deleteFeedbackAction(entry.id);
        toast.success("Avis supprime");
      } catch {
        toast.error("Impossible de supprimer cet avis");
      }
    });
  }

  return (
    <div className={`flex flex-col gap-2 rounded-xl border border-border p-3 ${entry.archived ? "opacity-60" : ""}`}>
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
      <div className="mt-1 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" disabled={pending} onClick={toggleArchived}>
          {entry.archived ? (
            <>
              <ArchiveRestore /> Restaurer
            </>
          ) : (
            <>
              <Archive /> Archiver
            </>
          )}
        </Button>
        <Button variant="destructive" size="sm" className="flex-1" disabled={pending} onClick={handleDelete}>
          <Trash2 /> Supprimer
        </Button>
      </div>
    </div>
  );
}
