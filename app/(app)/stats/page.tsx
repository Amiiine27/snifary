import { requireUser } from "@/lib/session";
import { getLibrarySections } from "@/lib/library";

export default async function StatsPage() {
  const user = await requireUser();
  const sections = await getLibrarySections(user.id);

  const collection = sections.find((s) => s.kind === "collection");
  const wishlists = sections.filter((s) => s.kind === "wishlist");

  const owned = collection?.items.map((i) => i.perfume) ?? [];
  const wished = wishlists.flatMap((w) => w.items.map((i) => i.perfume));

  const totalSpent = owned.reduce((sum, p) => sum + (p.price ?? 0), 0);

  const noteCounts = new Map<string, number>();
  for (const p of owned) {
    for (const n of [...p.notes.top, ...p.notes.heart, ...p.notes.base]) {
      noteCounts.set(n, (noteCounts.get(n) ?? 0) + 1);
    }
  }
  const topNotes = [...noteCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="flex flex-col gap-6 px-4 pt-8">
      <h1 className="text-2xl font-semibold">Statistiques</h1>

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Parfums possedes" value={owned.length} />
        <StatTile label="En wishlist" value={wished.length} />
        <StatTile label="Wishlists" value={wishlists.length} />
        <StatTile label="Depense estimee" value={`${totalSpent.toFixed(0)} €`} />
      </div>

      {topNotes.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Notes les plus frequentes</h2>
          <div className="flex flex-wrap gap-1.5">
            {topNotes.map(([note, count]) => (
              <span key={note} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                {note} · {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
