import { NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth";
import { exportAll } from "@/lib/discoveries";

export const runtime = "nodejs";

export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = await exportAll(userId);
  return new NextResponse(JSON.stringify({ exported_at: new Date().toISOString(), items }, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="unfold-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
