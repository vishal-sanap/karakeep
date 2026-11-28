import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionUserId } from "@/lib/auth";
import { oldestInActiveThreads, relatedToThisWeek, unopened } from "@/lib/rediscover";
import { lastThreadBuild, listThreads } from "@/lib/threads/queries";
import { MIN_THREAD_SIZE } from "@/lib/threads/build";
import { ItemRow } from "@/components/item-row";
import { LocalDate } from "@/components/local-date";
import { RebuildThreads } from "@/components/rebuild-threads";

export const dynamic = "force-dynamic";

/**
 * One place to wander your own library: things worth bringing back, then the
 * subjects (threads) your saves cluster into.
 */
export default async function ExplorePage() {
  const userId = await sessionUserId();
  if (!userId) redirect("/login");
  const [resurfaced, threadStarts, never, threads, build] = await Promise.all([
    relatedToThisWeek(userId),
    oldestInActiveThreads(userId),
    unopened(userId),
    listThreads(userId),
    lastThreadBuild(userId),
  ]);
  const nothingToBringBack = !resurfaced.length && !threadStarts.length && !never.length;

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <div className="space-y-2">
        <h1 className="page-title">Explore</h1>
        <p className="lede">
          unfold notices patterns in what you save and brings back what you&apos;ve forgotten. It changes as your library
          grows, so it&apos;s worth a look once a week.
        </p>
      </div>

      <section className="space-y-4" aria-labelledby="bring-back">
        <h2 id="bring-back" className="section-title">
          Bring back
        </h2>
        {nothingToBringBack ? (
          <p className="border-t border-rule py-6 text-ui text-pencil">
            Nothing to bring back yet. Things you saved a couple of weeks ago and haven&apos;t opened will show up here.
          </p>
        ) : (
          <ul className="border-b border-rule">
            {resurfaced.map((d) => (
              <ItemRow
                key={`r-${d.id}`}
                item={d}
                note={
                  <>
                    Close to{" "}
                    <Link href={`/d/${d.because_id}`} className="link">
                      {d.because_title ?? "something you saved this week"}
                    </Link>
                    , which you saved this week
                  </>
                }
              />
            ))}
            {threadStarts.map((d) => (
              <ItemRow
                key={`t-${d.thread_id}-${d.id}`}
                item={d}
                note={
                  <>
                    Where{" "}
                    <Link href={`/threads/${d.thread_id}`} className="link">
                      {d.thread_name}
                    </Link>{" "}
                    began; you added to it this week
                  </>
                }
              />
            ))}
            {never.map((d) => (
              <ItemRow key={`n-${d.id}`} item={d} note="Saved but never opened" />
            ))}
          </ul>
        )}
      </section>

      <section id="threads" className="scroll-mt-24 space-y-4" aria-labelledby="threads-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 id="threads-title" className="section-title">
              Threads
            </h2>
            <p className="lede">
              Subjects your saves keep coming back to, regrouped every night.
              {build && (
                <>
                  {" "}
                  Last grouped <LocalDate value={build.built_at} />.
                </>
              )}
            </p>
          </div>
          <RebuildThreads />
        </div>
        {threads.length === 0 ? (
          <p className="border-t border-rule py-6 text-ui text-pencil">
            No threads yet. Save {MIN_THREAD_SIZE} or more things about the same subject and they&apos;ll gather into a thread here.
          </p>
        ) : (
          <ul className="border-b border-rule">
            {threads.map((t) => (
              <li key={t.id} className="border-t border-rule py-5">
                <div className="flex items-baseline justify-between gap-4">
                  <Link href={`/threads/${t.id}`} className="font-serif text-entry font-semibold hover:underline">
                    {t.name}
                  </Link>
                  <span className="shrink-0 text-meta text-pencil">{t.size} items</span>
                </div>
                <p className="mt-1 text-meta text-pencil">{t.sample.map((s) => s.title ?? "Untitled").join("; ")}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
