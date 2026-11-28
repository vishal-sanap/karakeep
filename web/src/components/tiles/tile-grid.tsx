"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Mesh, Program, Renderer, Texture } from "ogl";
import { paintTile, type TileItem } from "./paint";
import { SearchOverlay } from "./search-overlay";

const MAX_TEXTURES = 80;
const FRICTION = 0.93; // per 60fps frame
const MAX_BEND = 0.07; // lens strength at full drag speed

const VERTEX = /* glsl */ `
attribute vec3 position;
attribute vec2 uv;
uniform vec2 uViewport;
uniform vec2 uCellPos;
uniform float uTile;
uniform float uBend;
uniform float uHover;
varying vec2 vUv;
varying vec2 vScreen;
void main() {
  vUv = uv;
  // hovered tile insets slightly
  vec2 local = position.xy * uTile * mix(1.0, 0.965, uHover);
  vec2 px = uCellPos + uTile * 0.5 + vec2(local.x, -local.y);   // pixels, y down
  vec2 ndc = vec2(px.x / uViewport.x * 2.0 - 1.0, 1.0 - px.y / uViewport.y * 2.0);
  // lens: pull toward the centre in proportion to drag speed (corner r2 == 1)
  vec2 a = ndc * vec2(uViewport.x / uViewport.y, 1.0);
  float r2 = dot(a, a) / (pow(uViewport.x / uViewport.y, 2.0) + 1.0);
  ndc *= 1.0 - uBend * r2;
  vScreen = ndc;
  gl_Position = vec4(ndc, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
uniform float uHover;
uniform float uAlpha;
varying vec2 vUv;
varying vec2 vScreen;
void main() {
  vec4 c = texture2D(tMap, vUv);
  c.rgb += uHover * 0.06;
  // fade into the background toward the top and bottom edges
  float edge = smoothstep(1.0, 0.7, abs(vScreen.y));
  vec3 bg = vec3(0.043, 0.039, 0.035);
  c.rgb = mix(bg, c.rgb, mix(0.25, 1.0, edge) * uAlpha);
  gl_FragColor = vec4(c.rgb, 1.0);
}`;

type Entry = { tex: Texture; canvas: HTMLCanvasElement; shownAt: number; lastUsed: number };

/** Which library item sits in grid cell (i, j). The library repeats as a block, offset per block row. */
function cellItem(i: number, j: number, n: number) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.6)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const mod = (a: number, b: number) => ((a % b) + b) % b;
  const idx = mod(j, rows) * cols + mod(i + 3 * Math.floor(j / rows), cols);
  return idx % n;
}

export function TileGrid({ items }: { items: TileItem[] }) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  const [hoverTitle, setHoverTitle] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  /** Set by the WebGL loop: glide to the nearest tile of an item. False if it isn't on the grid. */
  const flyToRef = useRef<((id: string) => boolean) | null>(null);

  // Ctrl+F / Cmd+F opens search over the tiles (only while this page is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onPick = (id: string) => {
    setSearchOpen(false);
    if (!flyToRef.current?.(id)) router.push(`/d/${id}`); // not a tile (e.g. still processing): open it
    else wrapRef.current?.focus();
  };

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || items.length === 0) return;
    let disposed = false;
    let raf = 0;
    let cleanup = () => {};

    (async () => {
      const ogl = await import("ogl");
      if (disposed) return;
      let renderer: Renderer;
      try {
        renderer = new ogl.Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 2), antialias: true });
      } catch {
        setFallback(true);
        return;
      }
      const gl = renderer.gl;
      gl.clearColor(0.043, 0.039, 0.035, 1);
      const canvas = gl.canvas as HTMLCanvasElement;
      canvas.style.display = "block";
      canvas.style.touchAction = "none";
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `Tiles of ${items.length} saved items. Drag to explore.`);
      wrap.appendChild(canvas);

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const geometry = new ogl.Plane(gl, { width: 1, height: 1, widthSegments: 12, heightSegments: 12 });
      const program: Program = new ogl.Program(gl, {
        vertex: VERTEX,
        fragment: FRAGMENT,
        uniforms: {
          tMap: { value: null },
          uViewport: { value: [1, 1] },
          uCellPos: { value: [0, 0] },
          uTile: { value: 200 },
          uBend: { value: 0 },
          uHover: { value: 0 },
          uAlpha: { value: 1 },
        },
        depthTest: false,
        depthWrite: false,
      });
      const mesh: Mesh = new ogl.Mesh(gl, { geometry, program });

      // --- textures -------------------------------------------------------
      const cache = new Map<string, Entry>();
      let dirty = true;
      const textureFor = (item: TileItem, now: number): Entry => {
        let e = cache.get(item.id);
        if (e) {
          e.lastUsed = now;
          return e;
        }
        const c = document.createElement("canvas");
        paintTile(c, item, null);
        const tex = new ogl.Texture(gl, { image: c, generateMipmaps: true, minFilter: gl.LINEAR_MIPMAP_LINEAR, magFilter: gl.LINEAR });
        e = { tex, canvas: c, shownAt: now, lastUsed: now };
        cache.set(item.id, e);
        if (item.hasImage) {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => {
            if (disposed || !cache.has(item.id)) return;
            paintTile(c, item, img);
            tex.image = c;
            tex.needsUpdate = true;
            e!.shownAt = performance.now();
            dirty = true;
          };
          img.src = `/api/tiles/img/${item.id}`;
        }
        if (cache.size > MAX_TEXTURES) {
          const oldest = [...cache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0];
          if (oldest && oldest[1].lastUsed < now) {
            gl.deleteTexture(oldest[1].tex.texture);
            cache.delete(oldest[0]);
          }
        }
        return e;
      };

      // --- view state -----------------------------------------------------
      let W = 1;
      let H = 1;
      let T = 240;
      const offset = { x: 0, y: 0 };
      const vel = { x: 0, y: 0 };
      let bend = 0;
      let dragging = false;
      let pointer: { x: number; y: number } | null = null;
      let downAt: { x: number; y: number; t: number } | null = null;
      let last: { x: number; y: number; t: number } | null = null;
      let hoverCell: { i: number; j: number } | null = null;
      let hoverAmt = 0;
      let fly: { x: number; y: number } | null = null;
      let pulse: { i: number; j: number; at: number } | null = null;
      const PULSE_MS = 2000;

      // Search result -> nearest cell holding that item -> glide there and pulse it.
      flyToRef.current = (id: string) => {
        const k = items.findIndex((it) => it.id === id);
        if (k < 0) return false;
        const ci = Math.floor((offset.x + W / 2) / T);
        const cj = Math.floor((offset.y + H / 2) / T);
        const cols = Math.max(1, Math.ceil(Math.sqrt(items.length * 1.6)));
        const rows = Math.max(1, Math.ceil(items.length / cols));
        let best: { i: number; j: number; d: number } | null = null;
        for (let dj = -(rows + 2); dj <= rows + 2; dj++) {
          for (let di = -(cols + 4); di <= cols + 4; di++) {
            const i = ci + di;
            const j = cj + dj;
            if (cellItem(i, j, items.length) !== k) continue;
            const d = di * di + dj * dj;
            if (!best || d < best.d) best = { i, j, d };
          }
        }
        if (!best) return false;
        const target = { x: best.i * T + T / 2 - W / 2, y: best.j * T + T / 2 - H / 2 };
        vel.x = vel.y = 0;
        if (reduceMotion) {
          offset.x = target.x;
          offset.y = target.y;
        } else fly = target;
        pulse = { i: best.i, j: best.j, at: performance.now() + (reduceMotion ? 0 : 450) };
        dirty = true;
        return true;
      };

      const resize = () => {
        W = wrap.clientWidth;
        H = wrap.clientHeight;
        T = Math.round(Math.min(Math.max(W / 4, 160), 340));
        renderer.setSize(W, H);
        program.uniforms.uViewport.value = [W, H];
        program.uniforms.uTile.value = T;
        dirty = true;
      };
      const ro = new ResizeObserver(resize);
      ro.observe(wrap);
      resize();
      // start with the first item near the top-left, half a tile in
      offset.x = -T * 0.25;
      offset.y = -T * 0.25;

      const cellAt = (sx: number, sy: number) => ({ i: Math.floor((sx + offset.x) / T), j: Math.floor((sy + offset.y) / T) });
      const local = (e: PointerEvent | WheelEvent) => {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };

      const onDown = (e: PointerEvent) => {
        canvas.setPointerCapture(e.pointerId);
        const p = local(e);
        dragging = true;
        downAt = { ...p, t: performance.now() };
        last = { ...p, t: performance.now() };
        vel.x = vel.y = 0;
        canvas.style.cursor = "grabbing";
      };
      const onMove = (e: PointerEvent) => {
        const p = local(e);
        pointer = p;
        if (dragging && last) {
          const now = performance.now();
          const dx = p.x - last.x;
          const dy = p.y - last.y;
          offset.x -= dx;
          offset.y -= dy;
          const dt = Math.max(now - last.t, 1) / 16.67;
          // smoothed velocity in px per 60fps frame
          vel.x = vel.x * 0.6 + (-dx / dt) * 0.4;
          vel.y = vel.y * 0.6 + (-dy / dt) * 0.4;
          last = { ...p, t: now };
          dirty = true;
        }
      };
      const onUp = (e: PointerEvent) => {
        const p = local(e);
        const moved = downAt ? Math.hypot(p.x - downAt.x, p.y - downAt.y) : 99;
        dragging = false;
        canvas.style.cursor = "grab";
        if (reduceMotion) vel.x = vel.y = 0;
        if (moved < 6) {
          const c = cellAt(p.x, p.y);
          const item = items[cellItem(c.i, c.j, items.length)];
          router.push(`/d/${item.id}`);
        }
        downAt = last = null;
      };
      const onLeave = () => {
        pointer = null;
        dirty = true;
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const k = e.deltaMode === 1 ? 16 : 1;
        if (reduceMotion) {
          offset.x += e.deltaX * k;
          offset.y += e.deltaY * k;
        } else {
          vel.x += e.deltaX * k * 0.12;
          vel.y += e.deltaY * k * 0.12;
        }
        dirty = true;
      };
      const onKey = (e: KeyboardEvent) => {
        const step = reduceMotion ? T : T * 0.075;
        const map: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        const d = map[e.key];
        if (!d) return;
        e.preventDefault();
        if (reduceMotion) {
          offset.x += d[0] * step;
          offset.y += d[1] * step;
        } else {
          vel.x += d[0] * step;
          vel.y += d[1] * step;
        }
        dirty = true;
      };
      canvas.style.cursor = "grab";
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      canvas.addEventListener("pointerleave", onLeave);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      wrap.addEventListener("keydown", onKey);

      // --- frame loop -----------------------------------------------------
      let prev = performance.now();
      let lastHoverId: string | null = null;
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min((now - prev) / 16.67, 4);
        prev = now;

        if (!dragging && (Math.abs(vel.x) > 0.02 || Math.abs(vel.y) > 0.02)) {
          offset.x += vel.x * dt;
          offset.y += vel.y * dt;
          const f = Math.pow(FRICTION, dt);
          vel.x *= f;
          vel.y *= f;
          dirty = true;
        } else if (!dragging) {
          vel.x = vel.y = 0;
        }

        // Glide toward a search result (eased), cancelled by any drag.
        let flySpeed = 0;
        if (fly && dragging) fly = null;
        if (fly) {
          const dx = (fly.x - offset.x) * Math.min(0.1 * dt, 1);
          const dy = (fly.y - offset.y) * Math.min(0.1 * dt, 1);
          offset.x += dx;
          offset.y += dy;
          flySpeed = Math.hypot(dx, dy) / Math.max(dt, 0.01);
          if (Math.hypot(fly.x - offset.x, fly.y - offset.y) < 0.5) {
            offset.x = fly.x;
            offset.y = fly.y;
            fly = null;
          }
          dirty = true;
        }
        if (pulse && now - pulse.at > PULSE_MS) pulse = null;
        if (pulse) dirty = true;

        const speed = Math.max(Math.hypot(vel.x, vel.y), flySpeed);
        const targetBend = reduceMotion ? 0 : Math.min(speed / 40, 1) * MAX_BEND;
        const nextBend = bend + (targetBend - bend) * Math.min(0.15 * dt, 1);
        if (Math.abs(nextBend - bend) > 1e-4) dirty = true;
        bend = Math.abs(nextBend) < 1e-4 ? 0 : nextBend;

        const nextHover = pointer && !dragging && speed < 1 ? cellAt(pointer.x, pointer.y) : null;
        if (nextHover?.i !== hoverCell?.i || nextHover?.j !== hoverCell?.j) {
          hoverCell = nextHover;
          hoverAmt = 0;
          dirty = true;
        }
        if (hoverCell && hoverAmt < 1) {
          hoverAmt = Math.min(1, hoverAmt + 0.12 * dt);
          dirty = true;
        }
        const hoverId = hoverCell ? items[cellItem(hoverCell.i, hoverCell.j, items.length)].id : null;
        if (hoverId !== lastHoverId) {
          lastHoverId = hoverId;
          canvas.style.cursor = dragging ? "grabbing" : hoverId ? "pointer" : "grab";
          setHoverTitle(hoverId ? (items.find((x) => x.id === hoverId)?.title ?? null) : null);
        }

        // fade-ins still running?
        for (const e of cache.values()) if (now - e.shownAt < 350) dirty = true;
        if (!dirty) return;
        dirty = false;

        renderer.bindFramebuffer();
        renderer.setViewport(W * renderer.dpr, H * renderer.dpr);
        gl.clear(gl.COLOR_BUFFER_BIT);
        program.uniforms.uBend.value = bend;
        const margin = 1;
        const i0 = Math.floor(offset.x / T) - margin;
        const i1 = Math.floor((offset.x + W) / T) + margin;
        const j0 = Math.floor(offset.y / T) - margin;
        const j1 = Math.floor((offset.y + H) / T) + margin;
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const item = items[cellItem(i, j, items.length)];
            const e = textureFor(item, now);
            const isHover = hoverCell?.i === i && hoverCell?.j === j;
            const isPulse = pulse?.i === i && pulse?.j === j;
            program.uniforms.tMap.value = e.tex;
            program.uniforms.uCellPos.value = [i * T - offset.x, j * T - offset.y];
            let h = isHover ? easeOut(hoverAmt) : 0;
            if (isPulse && pulse && now >= pulse.at) {
              // three soft pulses that fade out
              const t = (now - pulse.at) / PULSE_MS;
              h = Math.max(h, (0.5 - 0.5 * Math.cos(t * Math.PI * 6)) * (1 - t) * 2.2);
            }
            program.uniforms.uHover.value = h;
            program.uniforms.uAlpha.value = reduceMotion ? 1 : Math.min(1, (now - e.shownAt) / 350);
            mesh.draw();
          }
        }
      };
      raf = requestAnimationFrame(frame);

      cleanup = () => {
        flyToRef.current = null;
        cancelAnimationFrame(raf);
        ro.disconnect();
        wrap.removeEventListener("keydown", onKey);
        for (const e of cache.values()) gl.deleteTexture(e.tex.texture);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        canvas.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [items, router]);

  const search = searchOpen && <SearchOverlay onPick={onPick} onClose={() => setSearchOpen(false)} />;
  const searchButton = (
    <button
      onClick={() => setSearchOpen(true)}
      className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-xs text-stone-200 backdrop-blur hover:bg-black/80"
      aria-label="Search your library"
    >
      Search
      <kbd className="hidden rounded border border-white/20 px-1 text-[10px] text-stone-400 sm:inline">Ctrl F</kbd>
    </button>
  );

  if (fallback)
    return (
      <div className="relative h-full w-full">
        <FallbackGrid items={items} />
        {searchButton}
        {search}
      </div>
    );

  return (
    <div className="relative h-full w-full">
      <div ref={wrapRef} tabIndex={0} className="h-full w-full outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/20" />
      {searchButton}
      {search}
      {hoverTitle && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 max-w-[80%] -translate-x-1/2 truncate rounded-full bg-black/70 px-3 py-1 text-xs text-stone-100">
          {hoverTitle}
        </div>
      )}
      {/* Screen-reader and keyboard access to the same items. */}
      <ul className="sr-only">
        {items.map((it) => (
          <li key={it.id}>
            <Link href={`/d/${it.id}`}>{it.title ?? it.domain}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Plain HTML grid when WebGL isn't available. */
function FallbackGrid({ items }: { items: TileItem[] }) {
  return (
    <ul className="grid h-full grid-cols-2 content-start gap-px overflow-auto bg-stone-800 sm:grid-cols-4">
      {items.map((it) => (
        <li key={it.id} className="aspect-square bg-[#0b0a09]">
          <Link href={`/d/${it.id}`} className="flex h-full flex-col justify-between p-3 text-stone-100">
            <span className="text-xs font-semibold">{it.domain}</span>
            {it.hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/tiles/img/${it.id}`} alt="" className="mx-auto max-h-[55%] max-w-[70%] object-contain" />
            ) : (
              <span className="text-lg font-semibold leading-tight">{it.title}</span>
            )}
            <span className="font-mono text-[10px] text-stone-400">{it.year}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

