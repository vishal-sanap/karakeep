import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionUserId } from "@/lib/auth";
import { oldestInActiveThreads, relatedToThisWeek, unopened } from "@/lib/rediscover";
import { ItemRow } from "@/components/item-row";

export const dynamic = "force-dynamic";

export default async function RediscoverPage() {
  const userId = await sessionUserId();
  if (!userId) redirect("/login");
  const [never, resurfaced, threadOld] = await Promise.all([
    unopened(userId),
    relatedToThisWeek(userId),
    oldestInActiveThreads(userId),
  ]);
  const empty = !never.length && !resurfaced.length && !threadOld.length;

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="page-title">Rediscover</h1>
        <p className="lede">Things you saved and may have forgotten.</p>
      </div>

      {empty && (
        <p className="border-t border-rule py-10 text-ui text-pencil">
          Nothing to bring back yet. Items appear here once they&apos;re a couple of weeks old.
        </p>
      )}

      {resurfaced.length > 0 && (
        <Section title="Related to what you saved this week">
          {resurfaced.map((d) => (
            <ItemRow
              key={d.id}
              item={d}
              note={
                <>
                  Close to{" "}
                  <Link href={`/d/${d.because_id}`} className="link">
                    {d.because_title ?? "something you saved this week"}
                  </Link>
                </>
              }
            />
          ))}
        </Section>
      )}

      {threadOld.length > 0 && (
        <Section title="Where a thread you're adding to began">
          {threadOld.map((d) => (
            <ItemRow
              key={`${d.thread_id}-${d.id}`}
              item={d}
              note={
                <>
                  First item in{" "}
                  <Link href={`/threads/${d.thread_id}`} className="link">
                    {d.thread_name}
                  </Link>
                </>
              }
            />
          ))}
        </Section>
      )}

      {never.length > 0 && (
        <Section title="Saved but never opened">
          {never.map((d) => (
            <ItemRow key={d.id} item={d} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="section-title">{title}</h2>
      <ul className="border-b border-rule">{children}</ul>
    </section>
  );
}
