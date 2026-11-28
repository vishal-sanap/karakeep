import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionUserId } from "@/lib/auth";
import { searchDiscoveries } from "@/lib/search";
import { SaveForm } from "@/components/save-form";
import { DiscoveryCard } from "@/components/discovery-card";
import { PendingRefresher } from "@/components/pending-refresher";

export const dynamic = "force-dynamic";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; saved?: string }>;
}) {
  const userId = await sessionUserId();
  if (!userId) redirect("/login");
  const { q, saved } = await searchParams;
  const { items, degraded } = await searchDiscoveries(userId, q);
  // Keep refreshing while metadata is pending, or a fresh save is still being processed.
  const recent = (d: Date) => Date.now() - new Date(d).getTime() < 3 * 60_000;
  const hasPending = items.some(
    (i) => i.status === "pending" || (i.status === "ready" && !i.enriched_at && recent(i.saved_at)),
  );

  return (
    <div className="space-y-8">
      <SaveForm />

      <form action="/" role="search" className="flex items-center gap-3">
        <label htmlFor="library-search" className="sr-only">
          Search your library
        </label>
        <input
          id="library-search"
          name="q"
          defaultValue={q}
          placeholder="Search by what you remember about it"
          className="field"
        />
        {q && (
          <Link href="/" className="action shrink-0">
            Clear
          </Link>
        )}
      </form>

      <div>
        {saved && !q && <p className="mb-3 text-ui text-pen">Saved.</p>}
        {degraded && <p className="mb-3 text-ui text-pencil">Showing exact word matches only; the similarity search failed.</p>}
        {q && items.length > 0 && (
          <p className="mb-3 text-meta text-pencil">
            {items.length} {items.length === 1 ? "match" : "matches"} for &ldquo;{q}&rdquo;
          </p>
        )}

        {items.length === 0 ? (
          <p className="border-t border-rule py-10 text-ui text-pencil">
            {q ? "Nothing matched. Try describing it differently." : "Nothing saved yet. Paste a link above to start your library."}
          </p>
        ) : (
          <ul className="border-b border-rule">
            {items.map((d) => (
              <DiscoveryCard key={d.id} d={JSON.parse(JSON.stringify(d))} highlight={d.id === saved} summarizing={recent(d.saved_at)} />
            ))}
          </ul>
        )}
      </div>

      {hasPending && <PendingRefresher />}
    </div>
  );
}
