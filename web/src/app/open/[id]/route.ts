import { NextResponse } from "next/server";
import { z } from "zod";
import { sessionUserId } from "@/lib/auth";
import { markOpened } from "@/lib/discoveries";

export const runtime = "nodejs";

/** Records last_opened_at (for rediscovery) then sends the user to the original URL. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await sessionUserId();
  const id = z.string().uuid().safeParse((await params).id);
  if (!userId || !id.success) return NextResponse.redirect(new URL("/", req.url));
  const url = await markOpened(userId, id.data);
  if (!url || !/^https?:\/\//i.test(url)) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.redirect(url, 303);
}
