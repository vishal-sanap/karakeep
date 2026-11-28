import Link from "next/link";
import { listThreads } from "@/lib/threads/queries";
import { recentlyOpened, recurringTopics } from "@/lib/sidebar";
import { Thumb } from "./thumb";

// Nodes sit on a loop (an ellipse in a 100x100 box); dots mark the gaps between them.
const NODE_POS = [
  { x: 69, y: 17 },
  { x: 14, y: 50 },
  { x: 69, y: 83 },
];
const DOT_POS = [
  { x: 31, y: 17 },
  { x: 31, y: 83 },
  { x: 88, y: 50 },
];

function timeAgo(d: Date) {
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return days === 1 ? "yesterday" : `${days} days ago`;
  const weeks = Math.round(days / 7);
  return `${weeks} weeks ago`;
}

/** Library sidebar (wide screens): what your saves are clustering around, and what you've revisited. */
export async function LibrarySidebar({ userId }: { userId: string }) {
  const [threads, topics, recent] = await Promise.all([listThreads(userId), recurringTopics(userId, 3), recentlyOpened(userId, 3)]);
  const biggest = [...threads].sort((a, b) => b.size - a.size)[0];

  const nodes = biggest ? biggest.name.split(", ").slice(0, 3) : topics.map((t) => t.tag);
  const heading = biggest ? "Your biggest thread" : nodes.length >= 2 ? "A thread is forming" : null;

  return (
    <div className="space-y-10">
      <section aria-labelledby="forming">
        {heading ? (
          <>
            <h2 id="forming" className="section-title">
              {heading}
            </h2>
            <p className="mt-1 text-meta text-pencil">
              {biggest ? `${biggest.size} saves about the same subject.` : "Topics that keep turning up in what you save."}
            </p>
            <div className="relative mx-auto mt-4 aspect-[5/4] w-full max-w-[17rem]">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full text-rule" aria-hidden>
                <ellipse cx="50" cy="50" rx="38" ry="33" fill="none" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
              </svg>
              {DOT_POS.slice(0, nodes.length).map((p, i) => (
                <span key={i} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rule" style={{ left: `${p.x}%`, top: `${p.y}%` }} aria-hidden />
              ))}
              <ul>
                {nodes.map((n, i) => (
                  <li key={n} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${NODE_POS[i].x}%`, top: `${NODE_POS[i].y}%` }}>
                    <Link
                      href={`/?q=${encodeURIComponent(n)}`}
                      className="block whitespace-nowrap rounded-full border border-rule bg-sheet px-3.5 py-1.5 text-ui shadow-sm hover:border-pencil"
                    >
                      {n}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <Link href={biggest ? `/threads/${biggest.id}` : "/explore"} className="link mt-3 inline-block text-ui">
              {biggest ? "Open this thread" : "Explore connections"}
            </Link>
          </>
        ) : (
          <>
            <h2 id="forming" className="section-title">
              Threads
            </h2>
            <p className="mt-1 text-ui text-pencil">Save a few things on the same subject and you&apos;ll see them start to connect here.</p>
          </>
        )}
      </section>

      <section aria-labelledby="revisited" className="border-t border-rule pt-8">
        <h2 id="revisited" className="font-serif text-entry font-semibold">
          Recently revisited
        </h2>
        {recent.length ? (
          <ul className="mt-4 space-y-4">
            {recent.map((r) => (
              <li key={r.id}>
                <Link href={`/d/${r.id}`} className="group grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3">
                  <Thumb id={r.id} hasImage={Boolean(r.thumbnail_url)} label={r.domain ?? r.title ?? "?"} className="rounded-lg" />
                  <span className="min-w-0">
                    <span className="line-clamp-2 font-serif text-ui font-semibold group-hover:underline">{r.title ?? r.domain}</span>
                    <span className="text-meta text-pencil">{timeAgo(r.last_opened_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-ui text-pencil">Things you open again show up here.</p>
        )}
      </section>
    </div>
  );
}
