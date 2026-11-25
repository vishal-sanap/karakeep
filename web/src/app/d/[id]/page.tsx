import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { sessionUserId } from "@/lib/auth";
import { getDiscovery, relatedDiscoveries } from "@/lib/discoveries";
import { sharedTerms } from "@/lib/keywords";
import { threadsForDiscovery } from "@/lib/threads/queries";
import { LocalDate } from "@/components/local-date";
import { RelatedList } from "@/components/related-list";
import { TagList } from "@/components/tag-list";

export const dynamic = "force-dynamic";

export default async function DiscoveryPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await sessionUserId();
  if (!userId) redirect("/login");
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const [d, related, threads] = await Promise.all([
    getDiscovery(userId, id.data),
    relatedDiscoveries(userId, id.data),
    threadsForDiscovery(userId, id.data),
  ]);
  if (!d) notFound();

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-stone-500 hover:underline">← Library</Link>

      <article className="space-y-3 rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex gap-3">
          {d.favicon_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.favicon_url} alt="" width={20} height={20} className="mt-1 h-5 w-5 shrink-0 rounded-sm" referrerPolicy="no-referrer" />
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-snug">
              <a href={`/open/${d.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {d.title || d.original_url}
              </a>
            </h1>
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-stone-500">
              <span>{d.domain}</span>
              {d.resource_type && d.resource_type !== "webpage" && <span>· {d.resource_type}</span>}
              <span>· saved <LocalDate value={d.saved_at} /></span>
              {d.last_opened_at && <span>· opened <LocalDate value={d.last_opened_at} /></span>}
            </div>
          </div>
        </div>

        {d.summary && <p className="text-sm text-stone-700 dark:text-stone-300">{d.summary}</p>}
        {d.why_note && <p className="border-l-2 border-amber-400 pl-2 text-sm italic">{d.why_note}</p>}
        <TagList tags={d.tags} />
        {threads.length > 0 && (
          <p className="text-sm text-stone-500">
            In {threads.length === 1 ? "thread" : "threads"}{" "}
            {threads.map((t, i) => (
              <span key={t.id}>
                {i > 0 && ", "}
                <Link href={`/threads/${t.id}`} className="font-medium text-stone-700 underline underline-offset-2 dark:text-stone-300">
                  {t.name}
                </Link>
              </span>
            ))}
          </p>
        )}

        <a
          href={`/open/${d.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-medium text-stone-900 underline underline-offset-2 dark:text-stone-100"
        >
          Open original ↗
        </a>
      </article>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-stone-500">Related in your library</h2>
        {related.length > 0 ? (
          <RelatedList
            sourceId={d.id}
            items={related.map((r) => ({
              id: r.id,
              title: r.title,
              original_url: r.original_url,
              domain: r.domain,
              favicon_url: r.favicon_url,
              similarity: r.similarity,
              shared: sharedTerms(d, r),
            }))}
          />
        ) : (
          <p className="text-sm text-stone-500">
            {d.enriched_at ? "Nothing closely related yet. This fills in as your library grows." : "Still processing this item…"}
          </p>
        )}
      </section>
    </div>
  );
}
