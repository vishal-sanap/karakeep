import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionUserId } from "@/lib/auth";
import { lastThreadBuild, listThreads } from "@/lib/threads/queries";
import { MIN_THREAD_SIZE } from "@/lib/threads/build";
import { LocalDate } from "@/components/local-date";
import { RebuildThreads } from "@/components/rebuild-threads";

export const dynamic = "force-dynamic";

export default async function ThreadsPage() {
  const userId = await sessionUserId();
  if (!userId) redirect("/login");
  const [threads, build] = await Promise.all([listThreads(userId), lastThreadBuild(userId)]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="page-title">Threads</h1>
          <p className="lede">
            Things you&apos;ve saved that are about the same subject, regrouped every night.
            {build && (
              <>
                {" "}
                Last grouped <LocalDate value={build.built_at} /> from {build.item_count} items.
              </>
            )}
          </p>
        </div>
        <RebuildThreads />
      </div>

      {threads.length === 0 ? (
        <p className="border-t border-rule py-10 text-ui text-pencil">
          No threads yet. A thread forms when {MIN_THREAD_SIZE} or more saved items are about the same subject.
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
              <p className="mt-1 text-meta text-pencil">
                {t.sample.map((s) => s.title ?? "Untitled").join("; ")}
                {t.last_added && (
                  <>
                    . Latest added <LocalDate value={t.last_added} />.
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
