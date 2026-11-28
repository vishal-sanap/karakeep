"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { dismissRelationAction } from "@/app/actions";

type Item = {
  id: string;
  title: string | null;
  original_url: string;
  domain: string | null;
  favicon_url: string | null;
  similarity: number;
  /** Tags/title words both items share: a plain hint at the link. */
  shared: string[];
};

export function RelatedList({ sourceId, items }: { sourceId: string; items: Item[] }) {
  return (
    <ul className="border-b border-rule">
      {items.map((it) => (
        <RelatedRow key={it.id} sourceId={sourceId} item={it} />
      ))}
    </ul>
  );
}

function RelatedRow({ sourceId, item }: { sourceId: string; item: Item }) {
  const [hidden, setHidden] = useState(false);
  const [pending, start] = useTransition();
  if (hidden) return null;

  return (
    <li className={`group flex items-baseline justify-between gap-4 border-t border-rule py-3 ${pending ? "opacity-50" : ""}`}>
      <div className="min-w-0">
        <Link href={`/d/${item.id}`} className="font-serif text-ui font-semibold hover:underline">
          {item.title || item.original_url}
        </Link>
        <p className="text-meta text-pencil">
          {item.domain}
          {item.shared.length > 0 && <>. Both mention {item.shared.join(", ")}</>}
        </p>
      </div>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            await dismissRelationAction(sourceId, item.id);
            setHidden(true);
          })
        }
        className="action shrink-0 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
      >
        Not related
      </button>
    </li>
  );
}
