import { redirect } from "next/navigation";
import { sessionUserId } from "@/lib/auth";
import { listDiscoveries } from "@/lib/discoveries";
import { TileGrid } from "@/components/tiles/tile-grid";
import type { TileItem } from "@/components/tiles/paint";

export const dynamic = "force-dynamic";

export default async function TilesPage() {
  const userId = await sessionUserId();
  if (!userId) redirect("/login");
  const rows = await listDiscoveries(userId, { limit: 200 });
  const items: TileItem[] = rows
    .filter((d) => d.status !== "pending")
    .map((d) => ({
      id: d.id,
      title: d.title,
      domain: d.domain,
      tags: d.tags,
      year: new Date(d.saved_at).getFullYear(),
      type: d.resource_type,
      hasImage: Boolean(d.thumbnail_url),
    }));

  return (
    // Full-bleed: break out of the centred layout column, fill the viewport under the header.
    <div className="relative left-1/2 -mb-16 h-[calc(100dvh-5.5rem)] w-screen -translate-x-1/2 bg-[#0b0a09]">
      {items.length === 0 ? (
        <p className="pt-24 text-center text-sm text-stone-400">Save a few things first; they&apos;ll show up here as tiles.</p>
      ) : (
        <TileGrid items={items} />
      )}
    </div>
  );
}
