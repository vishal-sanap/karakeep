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

  const kind = d.resource_type && d.resource_type !== "webpage" ? d.resource_type : null;

  return (
    <div className="space-y-10">
      <Link href="/" className="action">
        Back to library
      </Link>

      <article className="space-y-4">
        <h1 className="page-title">
          <a href={`/open/${d.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {d.title || d.original_url}
          </a>
        </h1>
        <p className="flex flex-wrap items-center gap-x-1.5 text-meta text-pencil">
          {d.favicon_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.favicon_url} alt="" width={14} height={14} className="h-3.5 w-3.5 rounded-sm" referrerPolicy="no-referrer" />
          )}
          <span>
            {d.domain}
            {kind && `, ${kind}`}. Saved <LocalDate value={d.saved_at} />
            {d.last_opened_at && (
              <>
                , last opened <LocalDate value={d.last_opened_at} />
              </>
            )}
            .
          </span>
        </p>

        {d.why_note && <p className="max-w-prose font-serif text-entry italic text-pen">{d.why_note}</p>}
        {d.summary && <p className="max-w-prose font-serif text-ui leading-relaxed">{d.summary}</p>}
        <TagList tags={d.tags} />
        {threads.length > 0 && (
          <p className="text-ui text-pencil">
            Part of{" "}
            {threads.map((t, i) => (
              <span key={t.id}>
                {i > 0 && (i === threads.length - 1 ? " and " : ", ")}
                <Link href={`/threads/${t.id}`} className="link">
                  {t.name}
                </Link>
              </span>
            ))}
            .
          </p>
        )}

        <a href={`/open/${d.id}`} target="_blank" rel="noopener noreferrer" className="btn inline-block">
          Open original
        </a>
      </article>

      <section className="space-y-3">
        <h2 className="section-title">Related in your library</h2>
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
          <p className="text-ui text-pencil">
            {d.enriched_at ? "Nothing closely related yet. This fills in as your library grows." : "Still reading this page. Check back in a minute."}
          </p>
        )}
      </section>
    </div>
  );
}
