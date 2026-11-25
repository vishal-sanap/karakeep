import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requestUserId } from "@/lib/auth";
import { capture, CaptureError } from "@/lib/capture";
import { corsHeaders } from "@/lib/cors";
import { listDiscoveries } from "@/lib/discoveries";

export const runtime = "nodejs";

export function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request) {
  const headers = corsHeaders(req);
  const userId = await requestUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });

  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "expected application/json" }, { status: 415, headers });
  }
  try {
    const body = await req.json();
    const d = await capture(userId, body);
    return NextResponse.json(
      { id: d.id, status: d.status, created: d.created, title: d.title },
      { status: d.created ? 201 : 200, headers },
    );
  } catch (err) {
    if (err instanceof CaptureError || err instanceof ZodError || err instanceof SyntaxError) {
      return NextResponse.json({ error: "invalid request" }, { status: 400, headers });
    }
    console.error("[api/discoveries]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500, headers });
  }
}

export async function GET(req: Request) {
  const headers = corsHeaders(req);
  const userId = await requestUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  const items = await listDiscoveries(userId, { q });
  return NextResponse.json({ items }, { headers });
}
