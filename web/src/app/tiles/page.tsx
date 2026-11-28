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
    // Fills the whole window; the glass nav bar floats over the tiles.
    <div className="fixed inset-0 bg-[#14171b]">
      {items.length === 0 ? (
        <p className="px-4 pt-24 text-center text-ui text-[#9ba2a9]">Save a few links first. Each one becomes a tile here.</p>
      ) : (
        <TileGrid items={items} />
      )}
    </div>
  );
}
