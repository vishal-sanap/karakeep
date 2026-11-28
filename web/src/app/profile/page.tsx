import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { profileStats } from "@/lib/sidebar";
import { signOutAction } from "@/app/actions";
import { LocalDate } from "@/components/local-date";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/login");
  const s = await profileStats(user.id);

  const stats = [
    { n: s.saved, label: s.saved === 1 ? "thing saved" : "things saved" },
    { n: s.noted, label: s.noted === 1 ? "with a note on why" : "with a note on why" },
    { n: s.opened, label: "opened again later" },
    { n: s.threads, label: s.threads === 1 ? "thread" : "threads" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-ink font-serif text-title font-semibold text-paper" aria-hidden>
          {(user.email ?? "?").charAt(0).toUpperCase()}
        </span>
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="text-ui text-pencil">{user.email}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-rule bg-rule sm:grid-cols-4">
        {stats.map((x) => (
          <div key={x.label} className="bg-paper p-4">
            <dt className="sr-only">{x.label}</dt>
            <dd>
              <span className="block font-serif text-title font-semibold">{x.n}</span>
              <span className="text-meta text-pencil">{x.label}</span>
            </dd>
          </div>
        ))}
      </dl>

      <section className="space-y-2 border-t border-rule pt-6 text-ui">
        <h2 className="section-title">Account</h2>
        <p className="text-pencil">
          Joined <LocalDate value={user.created_at} />
          {s.first && (
            <>
              . First save <LocalDate value={s.first} />
            </>
          )}
          . You sign in with a link sent to your email; there&apos;s no password to remember.
        </p>
        <p className="flex flex-wrap gap-x-5 gap-y-2 pt-2">
          <Link href="/settings#data" className="link">
            Export or delete your data
          </Link>
          <Link href="/settings#extension" className="link">
            Set up the Chrome extension
          </Link>
        </p>
        <form action={signOutAction} className="pt-4">
          <button className="btn-quiet">Sign out</button>
        </form>
      </section>
    </div>
  );
}
