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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Threads</h1>
          <p className="text-sm text-stone-500">
            Groups of related things you&apos;ve saved, rebuilt nightly.
            {build && (
              <>
                {" "}
                Last built <LocalDate value={build.built_at} /> from {build.item_count} items.
              </>
            )}
          </p>
        </div>
        <RebuildThreads />
      </div>

      {threads.length === 0 ? (
        <p className="py-12 text-center text-sm text-stone-500">
          No threads yet. A thread forms once at least {MIN_THREAD_SIZE} saved items are about the same thing.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {threads.map((t) => (
            <li key={t.id}>
              <Link
                href={`/threads/${t.id}`}
                className="block h-full rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-600"
              >
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-stone-500">
                  {t.size} items{t.last_added && <> · last added <LocalDate value={t.last_added} /></>}
                </div>
                <ul className="mt-2 space-y-1">
                  {t.sample.map((s) => (
                    <li key={s.id} className="truncate text-sm text-stone-600 dark:text-stone-400">
                      {s.title ?? "Untitled"}
                    </li>
                  ))}
                </ul>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
