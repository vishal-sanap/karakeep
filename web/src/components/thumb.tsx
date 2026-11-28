"use client";
import { useState } from "react";

/** Stable hue per source, so lettered blocks differ between sites. */
function hue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

/**
 * An item's preview image via the same-origin proxy (works where sites block
 * hotlinking), or a tinted block with the source's initial.
 */
export function Thumb({ id, hasImage, label, className = "" }: { id: string; hasImage: boolean; label: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const show = hasImage && !failed;
  const name = label.replace(/^www\./, "");
  return (
    <div
      className={`aspect-[3/2] w-full overflow-hidden rounded-xl border border-rule ${className}`}
      style={show ? undefined : { background: `hsl(${hue(name)} 30% 50% / 0.16)` }}
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/tiles/img/${id}`} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center font-serif text-heading font-semibold text-pencil" aria-hidden>
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}
