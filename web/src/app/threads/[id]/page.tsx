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
    <div className="space-y-6">
      <Link href="/threads" className="text-sm text-stone-500 hover:underline">← Threads</Link>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{thread.name}</h1>
        <p className="text-sm text-stone-500">{thread.size} items, newest first</p>
      </div>
      <ul className="space-y-2">
        {primary.map((m) => (
          <ItemRow key={m.id} item={m} />
        ))}
      </ul>
      {also.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-stone-500">Also close to this thread</h2>
          <ul className="space-y-2">
            {also.map((m) => (
              <ItemRow key={m.id} item={m} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
