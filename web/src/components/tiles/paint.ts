/**
 * Paints one library tile onto a square 2D canvas, which then becomes a WebGL
 * texture. Layout: source top-left, year top-right, image in the middle,
 * title (serif) and tags at the bottom. Items without an image get a flat,
 * muted colour block carrying the title instead.
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

/** Dark slate palette, matching the site's dark tokens. */
export const TILE_BG = "#14171b";
const LINE = "rgba(228,231,234,0.08)";
const TEXT = "#e4e7ea";
const MUTED = "#9ba2a9";

/** Font stacks resolved from the page (next/font generates hashed family names). */
const fonts = { serif: "Georgia, serif", sans: "system-ui, sans-serif" };
export function setTileFonts(serif: string, sans: string) {
  if (serif) fonts.serif = serif;
  if (sans) fonts.sans = sans;
}

/** Stable hue per source, for the no-image tiles. */
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
  const pad = 26;
  const ctx = canvas.getContext("2d")!;
  canvas.width = S;
  canvas.height = S;
  ctx.fillStyle = TILE_BG;
  ctx.fillRect(0, 0, S, S);
  // hairline grid (right + bottom, so neighbours share one line)
  ctx.fillStyle = LINE;
  ctx.fillRect(S - 1, 0, 1, S);
  ctx.fillRect(0, S - 1, S, 1);

  const domain = (item.domain ?? "").replace(/^www\./, "");
  const title = item.title ?? domain ?? "Untitled";
  const hasImg = Boolean(img && img.naturalWidth > 0);

  // Top row: source left, year right.
  ctx.textBaseline = "top";
  ctx.font = `500 17px ${fonts.sans}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.fillText(ellipsize(ctx, domain, S * 0.62), pad, pad);
  ctx.textAlign = "right";
  ctx.fillText(String(item.year), S - pad, pad);

  // Middle: image (contained) or a flat colour block with the title.
  const box = { x: pad, y: S * 0.15, w: S - pad * 2, h: S * 0.5 };
  if (hasImg && img) {
    const r = Math.min(box.w / img.naturalWidth, box.h / img.naturalHeight);
    const w = img.naturalWidth * r;
    const h = img.naturalHeight * r;
    ctx.drawImage(img, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
  } else {
    ctx.fillStyle = `hsl(${hue(domain || title)} 16% 21%)`;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = TEXT;
    ctx.textAlign = "left";
    ctx.font = `600 34px ${fonts.serif}`;
    const lines = wrap(ctx, title, box.w - 44, 4);
    const lh = 42;
    const top = box.y + (box.h - lines.length * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, box.x + 22, top + i * lh + 4));
  }

  // Bottom: title (when not already in the block), then tags.
  ctx.textAlign = "left";
  let y = box.y + box.h + 22;
  if (hasImg) {
    ctx.fillStyle = TEXT;
    ctx.font = `600 25px ${fonts.serif}`;
    for (const l of wrap(ctx, title, S - pad * 2, 2)) {
      ctx.fillText(l, pad, y);
      y += 31;
    }
  }
  const tags = [item.type && item.type !== "webpage" ? item.type : null, ...item.tags].filter(Boolean).slice(0, 4) as string[];
  if (tags.length) {
    ctx.fillStyle = MUTED;
    ctx.font = `16px ${fonts.sans}`;
    ctx.fillText(ellipsize(ctx, tags.join("   "), S - pad * 2), pad, Math.max(y + 6, S - pad - 18));
  }
}
