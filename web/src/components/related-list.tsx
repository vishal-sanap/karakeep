"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { dismissRelationAction, explainRelationAction } from "@/app/actions";

type Item = {
  id: string;
  title: string | null;
  original_url: string;
  domain: string | null;
  summary: string | null;
  favicon_url: string | null;
  similarity: number;
  explanation: string | null;
};

export function RelatedList({ sourceId, items, canExplain }: { sourceId: string; items: Item[]; canExplain: boolean }) {
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <RelatedRow key={it.id} sourceId={sourceId} item={it} canExplain={canExplain} />
      ))}
    </ul>
  );
}

function RelatedRow({ sourceId, item, canExplain }: { sourceId: string; item: Item; canExplain: boolean }) {
  const [explanation, setExplanation] = useState(item.explanation);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [pending, start] = useTransition();
  if (hidden) return null;

  return (
    <li className={`rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900 ${pending ? "opacity-70" : ""}`}>
      <div className="flex gap-2">
        {item.favicon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.favicon_url} alt="" width={16} height={16} className="mt-0.5 h-4 w-4 shrink-0 rounded-sm" referrerPolicy="no-referrer" />
        ) : (
          <div className="mt-0.5 h-4 w-4 shrink-0 rounded-sm bg-stone-200 dark:bg-stone-700" />
        )}
        <div className="min-w-0 flex-1">
          <Link href={`/d/${item.id}`} className="text-sm font-medium hover:underline">
            {item.title || item.original_url}
          </Link>
          <div className="text-xs text-stone-500">{item.domain}</div>

          {explanation ? (
            <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400">{explanation}</p>
          ) : error ? (
            <p className="mt-1.5 text-xs text-red-600">{error}</p>
          ) : null}

          <div className="mt-1.5 flex gap-3 text-xs text-stone-500">
            {canExplain && !explanation && (
              <button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await explainRelationAction(sourceId, item.id);
                    if (r.explanation) setExplanation(r.explanation);
                    else setError(r.error ?? "Couldn't explain this.");
                  })
                }
                className="hover:text-stone-900 dark:hover:text-stone-100"
              >
                {pending ? "Thinking…" : "Why related?"}
              </button>
            )}
            <button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await dismissRelationAction(sourceId, item.id);
                  setHidden(true);
                })
              }
              className="hover:text-red-600"
            >
              Not related
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
