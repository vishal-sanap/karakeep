import { NextResponse } from "next/server";
import { z } from "zod";
import { sessionUserId } from "@/lib/auth";
import { getDiscovery } from "@/lib/discoveries";
import { FetchBlockedError, safeFetchBytes } from "@/lib/fetcher";

export const runtime = "nodejs";

// Raster formats only. SVG can carry script, and this is served from our origin.
const ALLOWED = /^image\/(jpeg|png|webp|gif|avif)\b/i;

/**
 * Same-origin copy of one of the user's own discoveries' preview image, so the
 * tiles view can use it as a WebGL texture (cross-origin images can't be).
 * Not an open proxy: it only fetches the stored thumbnail of an item the
 * signed-in user owns, through the SSRF-hardened fetcher.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await sessionUserId();
  if (!userId) return new NextResponse(null, { status: 401 });
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return new NextResponse(null, { status: 404 });
  const d = await getDiscovery(userId, id.data);
  if (!d?.thumbnail_url) return new NextResponse(null, { status: 404 });

  try {
    const res = await safeFetchBytes(d.thumbnail_url, "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8");
    if (res.status !== 200 || res.truncated || !ALLOWED.test(res.contentType) || res.bytes.length === 0) {
      return new NextResponse(null, { status: 404 });
    }
    return new NextResponse(new Uint8Array(res.bytes), {
      headers: {
        "content-type": res.contentType.split(";")[0],
        "cache-control": "private, max-age=86400",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  } catch (err) {
    if (!(err instanceof FetchBlockedError)) console.warn("[tiles/img]", d.id, err instanceof Error ? err.message : err);
    return new NextResponse(null, { status: 404 });
  }
}
