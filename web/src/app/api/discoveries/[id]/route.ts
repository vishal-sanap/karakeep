import { NextResponse } from "next/server";
import { z } from "zod";
import { requestUserId } from "@/lib/auth";
import { deleteDiscovery, getDiscovery } from "@/lib/discoveries";
import { setWhyNote } from "@/lib/capture";

export const runtime = "nodejs";

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const userId = await requestUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "not found" }, { status: 404 });
  const d = await getDiscovery(userId, id.data);
  return d ? NextResponse.json(d) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requestUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = idSchema.safeParse((await params).id);
  const body = z.object({ why_note: z.string().max(500).nullable() }).safeParse(await req.json().catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });
  await setWhyNote(userId, id.data, body.data.why_note);
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const userId = await requestUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "not found" }, { status: 404 });
  await deleteDiscovery(userId, id.data);
  return new NextResponse(null, { status: 204 });
}
