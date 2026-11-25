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
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Rediscover</h1>
        <p className="text-sm text-stone-500">Things you saved and may have forgotten.</p>
      </div>

      {empty && (
        <p className="py-12 text-center text-sm text-stone-500">
          Nothing to resurface yet. This fills in as your library ages: items show up here after a couple of weeks.
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
                  Close to <Link href={`/d/${d.because_id}`} className="underline">{d.because_title ?? "a recent save"}</Link>
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
                  Oldest in <Link href={`/threads/${d.thread_id}`} className="underline">{d.thread_name}</Link>
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
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-stone-500">{title}</h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}
