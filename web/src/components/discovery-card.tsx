"use client";
import { useState, useTransition } from "react";
import { deleteAction, updateWhyAction } from "@/app/actions";
import type { Discovery } from "@/lib/discoveries";
import { LocalDate } from "./local-date";

type Props = { d: Omit<Discovery, "saved_at" | "last_opened_at"> & { saved_at: string; last_opened_at: string | null }; highlight?: boolean };

export function DiscoveryCard({ d, highlight }: Props) {
  const [editing, setEditing] = useState(false);
  const [why, setWhy] = useState(d.why_note ?? "");
  const [pending, start] = useTransition();
  const title = d.title || d.original_url;

  return (
    <li
      className={`group rounded-xl border bg-white p-4 dark:bg-stone-900 ${
        highlight ? "border-emerald-400" : "border-stone-200 dark:border-stone-800"
      } ${pending ? "opacity-60" : ""}`}
    >
      <div className="flex gap-3">
        {d.favicon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.favicon_url} alt="" width={16} height={16} className="mt-1 h-4 w-4 shrink-0 rounded-sm" referrerPolicy="no-referrer" />
        ) : (
          <div className="mt-1 h-4 w-4 shrink-0 rounded-sm bg-stone-200 dark:bg-stone-700" />
        )}
        <div className="min-w-0 flex-1">
          <a href={`/open/${d.id}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
            {title}
          </a>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
            <span>{d.domain}</span>
            {d.resource_type && d.resource_type !== "webpage" && <span>· {d.resource_type}</span>}
            <span>· <LocalDate value={d.saved_at} /></span>
            {d.status === "pending" && <span className="text-amber-600">· fetching details…</span>}
            {d.status === "failed" && <span className="text-red-600">· couldn&apos;t fetch details</span>}
          </div>
          {d.summary && <p className="mt-2 line-clamp-2 text-sm text-stone-600 dark:text-stone-400">{d.summary}</p>}

          {editing ? (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  await updateWhyAction(d.id, why);
                  setEditing(false);
                });
              }}
            >
              <input
                autoFocus
                value={why}
                maxLength={500}
                onChange={(e) => setWhy(e.target.value)}
                placeholder="Why did you save this?"
                className="w-full rounded-md border border-stone-300 bg-transparent px-2 py-1 text-sm dark:border-stone-700"
              />
              <button className="text-sm font-medium">Save</button>
              <button type="button" className="text-sm text-stone-500" onClick={() => setEditing(false)}>Cancel</button>
            </form>
          ) : d.why_note ? (
            <p className="mt-2 border-l-2 border-amber-400 pl-2 text-sm italic">{d.why_note}</p>
          ) : null}

          <div className="mt-2 flex gap-3 text-xs text-stone-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
            {!editing && (
              <button onClick={() => setEditing(true)} className="hover:text-stone-700 dark:hover:text-stone-200">
                {d.why_note ? "Edit why" : "Add why"}
              </button>
            )}
            <button
              onClick={() => confirm("Delete this item?") && start(() => deleteAction(d.id))}
              className="hover:text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
