import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { sessionUserId } from "@/lib/auth";
import { getThread } from "@/lib/threads/queries";
import { ItemRow } from "@/components/item-row";

export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await sessionUserId();
  if (!userId) redirect("/login");
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const data = await getThread(userId, id.data);
  if (!data) notFound();
  const { thread, members } = data;
  const primary = members.filter((m) => m.is_primary);
  const also = members.filter((m) => !m.is_primary);

  return (
    <div className="space-y-8">
      <Link href="/threads" className="action">
        Back to threads
      </Link>
      <div className="space-y-1">
        <h1 className="page-title">{thread.name}</h1>
        <p className="lede">{thread.size} items, newest first</p>
      </div>
      <ul className="border-b border-rule">
        {primary.map((m) => (
          <ItemRow key={m.id} item={m} />
        ))}
      </ul>
      {also.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-title">Also close to this thread</h2>
          <ul className="border-b border-rule">
            {also.map((m) => (
              <ItemRow key={m.id} item={m} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
