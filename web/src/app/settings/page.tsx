import { redirect } from "next/navigation";
import { sessionUserId } from "@/lib/auth";
import { listApiTokens } from "@/lib/tokens";
import { deleteAllAction, signOutAction } from "@/app/actions";
import { TokenManager } from "@/components/token-manager";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const userId = await sessionUserId();
  if (!userId) redirect("/login");
  const tokens = await listApiTokens(userId);
  const { deleted } = await searchParams;

  const section = "space-y-3 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900";

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      <section className={section}>
        <h2 className="font-medium">Chrome extension</h2>
        <p className="text-sm text-stone-500">
          Create a token, then paste it with this site&apos;s URL into the extension&apos;s options page.
        </p>
        <TokenManager
          tokens={tokens.map((t) => ({
            id: t.id,
            name: t.name,
            created_at: t.created_at.toISOString(),
            last_used_at: t.last_used_at?.toISOString() ?? null,
          }))}
        />
      </section>

      <section className={section}>
        <h2 className="font-medium">Your data</h2>
        <p className="text-sm text-stone-500">
          unfold stores each page&apos;s URL, title, description, tags and your note. It never stores full page copies.
          In later phases page text is sent to an AI provider to generate a summary and tags, then discarded.
        </p>
        <a href="/api/export" className="inline-block text-sm font-medium underline">Export everything (JSON)</a>
        <form action={deleteAllAction} className="flex flex-wrap items-center gap-2 pt-2">
          <input
            name="confirm"
            placeholder='Type "delete" to confirm'
            className="rounded-md border border-stone-300 bg-transparent px-2 py-1 text-sm dark:border-stone-700"
          />
          <button className="text-sm font-medium text-red-600">Delete all my data</button>
        </form>
        {deleted && <p className="text-sm text-emerald-600">All data deleted.</p>}
      </section>

      <form action={signOutAction}>
        <button className="text-sm text-stone-500 hover:underline">Sign out</button>
      </form>
    </div>
  );
}
