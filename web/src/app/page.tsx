import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionUserId } from "@/lib/auth";
import { searchDiscoveries } from "@/lib/search";
import { exploreNudge } from "@/lib/rediscover";
import { Capture } from "@/components/capture";
import { LibrarySearch } from "@/components/library-search";
import { DiscoveryCard } from "@/components/discovery-card";
import { PendingRefresher } from "@/components/pending-refresher";
import { LibrarySidebar } from "@/components/library-sidebar";
import { libraryCount } from "@/lib/sidebar";

export const dynamic = "force-dynamic";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; saved?: string; search?: string; import?: string }>;
}) {
  const userId = await sessionUserId();
  if (!userId) redirect("/login");
  const { q, saved, search, import: importParam } = await searchParams;
  const [{ items, degraded }, nudge, total] = await Promise.all([
    searchDiscoveries(userId, q),
    q ? null : exploreNudge(userId),
    libraryCount(userId),
  ]);
  // Keep refreshing while metadata is pending, or a fresh save is still being processed.
  const recent = (d: Date) => Date.now() - new Date(d).getTime() < 3 * 60_000;
  const hasPending = items.some(
    (i) => i.status === "pending" || (i.status === "ready" && !i.enriched_at && recent(i.saved_at)),
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:gap-12 2xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:gap-16">
    <div className="min-w-0 space-y-8">
      <div className="flex items-baseline gap-3">
        <h1 className="font-serif text-[2.5rem] font-semibold leading-none tracking-tight">Your library</h1>
        <span className="text-ui text-pencil">{total} saved</span>
      </div>
      <Capture autoImport={importParam === "1"} toolbar={<LibrarySearch q={q} autoOpen={search === "1"} />} />

      {nudge && (
        <p className="rounded-2xl border border-rule bg-sheet px-4 py-3 text-ui">
          <span className="text-pencil">{nudge.reason} </span>
          <Link href={`/d/${nudge.id}`} className="font-serif font-semibold hover:underline">
            {nudge.title ?? nudge.domain}
          </Link>
          <span className="text-pencil">. </span>
          <Link href="/explore" className="link whitespace-nowrap">
            More in Explore
          </Link>
        </p>
      )}

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
    <aside className="hidden border-l border-rule pl-10 lg:block" aria-label="Your library at a glance">
      <div className="sticky top-24">
        <LibrarySidebar userId={userId} />
      </div>
    </aside>
    </div>
  );
}
