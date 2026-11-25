import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionUserId } from "@/lib/auth";
import { listDiscoveries } from "@/lib/discoveries";
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
  const items = await listDiscoveries(userId, { q });
  const hasPending = items.some((i) => i.status === "pending");

  return (
    <div className="space-y-6">
      <SaveForm />

      <form action="/" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search your library… (try a vague description)"
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500 dark:border-stone-700 dark:bg-stone-900"
        />
        {q && (
          <Link href="/" className="self-center text-sm text-stone-500 hover:underline">Clear</Link>
        )}
      </form>

      {saved && !q && <p className="text-sm text-emerald-600">Saved.</p>}

      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-stone-500">
          {q ? "Nothing matched. Try different words." : "Nothing saved yet. Paste a link above, or use the extension."}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((d) => (
            <DiscoveryCard key={d.id} d={JSON.parse(JSON.stringify(d))} highlight={d.id === saved} />
          ))}
        </ul>
      )}

      {hasPending && <PendingRefresher />}
    </div>
  );
}
