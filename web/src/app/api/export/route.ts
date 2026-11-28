import { NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth";
import { exportAll } from "@/lib/discoveries";
import { toBookmarksHtml, toCsv, toTxt } from "@/lib/bulk";

export const runtime = "nodejs";

const FORMATS = {
  json: { ext: "json", type: "application/json" },
  csv: { ext: "csv", type: "text/csv; charset=utf-8" },
  txt: { ext: "txt", type: "text/plain; charset=utf-8" },
  html: { ext: "html", type: "text/html; charset=utf-8" },
} as const;

/** GET /api/export?format=json|csv|txt|html (bookmarks file browsers can import). */
export async function GET(req: Request) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const requested = new URL(req.url).searchParams.get("format") ?? "json";
  const format = (requested in FORMATS ? requested : "json") as keyof typeof FORMATS;
  const items = await exportAll(userId);
  const date = new Date().toISOString().slice(0, 10);

  const body =
    format === "csv"
      ? toCsv(items)
      : format === "txt"
        ? toTxt(items)
        : format === "html"
          ? toBookmarksHtml(items)
          : JSON.stringify({ exported_at: new Date().toISOString(), items }, null, 2);

  return new NextResponse(body, {
    headers: {
      "content-type": FORMATS[format].type,
      "content-disposition": `attachment; filename="unfold-${format === "html" ? "bookmarks" : "export"}-${date}.${FORMATS[format].ext}"`,
      "x-content-type-options": "nosniff",
    },
  });
}
