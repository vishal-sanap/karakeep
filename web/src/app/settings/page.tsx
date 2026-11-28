import { redirect } from "next/navigation";
import { sessionUserId } from "@/lib/auth";
import { listApiTokens } from "@/lib/tokens";
import { deleteAllAction, signOutAction } from "@/app/actions";
import { TokenManager } from "@/components/token-manager";
import { BulkImport } from "@/components/bulk-import";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const userId = await sessionUserId();
  if (!userId) redirect("/login");
  const tokens = await listApiTokens(userId);
  const { deleted } = await searchParams;

  const section = "space-y-3 border-t border-rule pt-6";

  return (
    <div className="space-y-10">
      <h1 className="page-title">Settings</h1>

      <section id="extension" className={`${section} scroll-mt-24`}>
        <h2 className="section-title">Chrome extension</h2>
        <p className="lede">Create a token, then paste it and this site&apos;s address into the extension&apos;s options page.</p>
        <TokenManager
          tokens={tokens.map((t) => ({
            id: t.id,
            name: t.name,
            created_at: t.created_at.toISOString(),
            last_used_at: t.last_used_at?.toISOString() ?? null,
          }))}
        />
      </section>

      <section id="import" className={`${section} scroll-mt-24`}>
        <h2 className="section-title">Import links</h2>
        <p className="lede">Add many links at once. Links already in your library are skipped.</p>
        <BulkImport />
      </section>

      <section id="data" className={`${section} scroll-mt-24`}>
        <h2 className="section-title">Your data</h2>
        <p className="lede">
          unfold stores each page&apos;s URL, title, a short summary, tags, your note and a numeric embedding. It never
          stores full page copies. Page text is processed on this server to make the summary, tags and embedding, then
          discarded; nothing is sent to an AI service.
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-ui">
          <span className="text-pencil">Download your library as</span>
          <a href="/api/export?format=json" className="link">JSON (everything)</a>
          <a href="/api/export?format=csv" className="link">CSV</a>
          <a href="/api/export?format=html" className="link">browser bookmarks</a>
          <a href="/api/export?format=txt" className="link">a plain list of links</a>
        </p>
        <form action={deleteAllAction} className="flex flex-wrap items-center gap-3 pt-3">
          <label htmlFor="confirm-delete" className="sr-only">
            Type delete to confirm
          </label>
          <input id="confirm-delete" name="confirm" placeholder='Type "delete" to confirm' className="field max-w-56" />
          <button className="text-ui font-semibold text-stamp hover:underline">Delete all my data</button>
        </form>
        {deleted && <p className="text-ui text-pen">All your data was deleted.</p>}
      </section>

      <form action={signOutAction}>
        <button className="action text-ui">Sign out</button>
      </form>
    </div>
  );
}
