/**
 * Paints one library tile onto a square 2D canvas, which then becomes a WebGL
 * texture. Layout: domain top-left, title top-right, image centred, tags
 * bottom-left, year bottom-right. Items without an image get a typographic tile.
 */

export type TileItem = {
  id: string;
  title: string | null;
  domain: string | null;
  tags: string[];
  year: number;
  type: string | null;
  hasImage: boolean;
};

export const TILE_PX = 512;

const BG = "#0b0a09";
const LINE = "rgba(255,255,255,0.08)";
const TEXT = "#f5f5f4";
const MUTED = "rgba(245,245,244,0.55)";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS = "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";

/** Stable hue per domain, for the no-image tiles. */
function hue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

export function paintTile(canvas: HTMLCanvasElement, item: TileItem, img: HTMLImageElement | null) {
  const S = TILE_PX;
  const pad = 22;
  const ctx = canvas.getContext("2d")!;
  canvas.width = S;
  canvas.height = S;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, S, S);
  // hairline grid border (right + bottom, so neighbours share one line)
  ctx.fillStyle = LINE;
  ctx.fillRect(S - 1, 0, 1, S);
  ctx.fillRect(0, S - 1, S, 1);

  const domain = (item.domain ?? "").replace(/^www\./, "");
  const title = item.title ?? domain ?? "Untitled";

  // Top row: domain left, title right.
  ctx.textBaseline = "top";
  ctx.font = `600 15px ${SANS}`;
  ctx.fillStyle = TEXT;
  ctx.textAlign = "left";
  const domainText = ellipsize(ctx, domain, S * 0.38);
  ctx.fillText(domainText, pad, pad);
  ctx.font = `13px ${MONO}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "right";
  const titleLines = wrap(ctx, title.toUpperCase(), S * 0.5, 2);
  titleLines.forEach((l, i) => ctx.fillText(l, S - pad, pad + i * 17));

  // Middle: image (contained, centred) or typographic fallback.
  const box = { x: S * 0.18, y: S * 0.2, w: S * 0.64, h: S * 0.56 };
  if (img && img.naturalWidth > 0) {
    const r = Math.min(box.w / img.naturalWidth, box.h / img.naturalHeight);
    const w = img.naturalWidth * r;
    const h = img.naturalHeight * r;
    ctx.drawImage(img, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
  } else {
    const h = hue(domain || title);
    const g = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
    g.addColorStop(0, `hsl(${h} 45% 22%)`);
    g.addColorStop(1, `hsl(${(h + 40) % 360} 50% 12%)`);
    ctx.fillStyle = g;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = TEXT;
    ctx.textAlign = "left";
    ctx.font = `600 30px ${SANS}`;
    const lines = wrap(ctx, title, box.w - 36, 4);
    const lh = 36;
    const top = box.y + (box.h - lines.length * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, box.x + 18, top + i * lh));
  }

  // Bottom row: tag chips left, year right.
  ctx.textBaseline = "middle";
  ctx.font = `11px ${MONO}`;
  const chipY = S - pad - 9;
  let x = pad;
  const chips = [item.type && item.type !== "webpage" ? item.type : null, ...item.tags].filter(Boolean).slice(0, 3) as string[];
  for (const c of chips) {
    const label = ellipsize(ctx, c.toUpperCase(), 110);
    const w = ctx.measureText(label).width + 14;
    if (x + w > S * 0.78) break;
    ctx.strokeStyle = "rgba(245,245,244,0.35)";
    ctx.lineWidth = 1;
    roundRect(ctx, x + 0.5, chipY - 9.5, w, 19, 9.5);
    ctx.stroke();
    ctx.fillStyle = TEXT;
    ctx.textAlign = "left";
    ctx.fillText(label, x + 7, chipY + 0.5);
    x += w + 6;
  }
  ctx.fillStyle = MUTED;
  ctx.textAlign = "right";
  ctx.fillText(String(item.year), S - pad, chipY + 0.5);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
