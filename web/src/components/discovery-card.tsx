"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteAction, updateWhyAction } from "@/app/actions";
import type { Discovery } from "@/lib/discoveries";
import { LocalDate } from "./local-date";
import { TagList } from "./tag-list";

type Props = {
  d: Omit<Discovery, "saved_at" | "last_opened_at" | "enriched_at"> & {
    saved_at: string;
    last_opened_at: string | null;
    enriched_at: string | null;
  };
  highlight?: boolean;
  /** Saved moments ago: a ready-but-unenriched item is still being processed. */
  summarizing?: boolean;
};

/**
 * One library entry. On wide screens the why-note hangs in the left margin
 * in blue pen, like a note written beside a passage; on phones it sits under
 * the title.
 */
export function DiscoveryCard({ d, highlight, summarizing }: Props) {
  const [editing, setEditing] = useState(false);
  const [why, setWhy] = useState(d.why_note ?? "");
  const [pending, start] = useTransition();
  const title = d.title || d.original_url;
  const kind = d.resource_type && d.resource_type !== "webpage" ? d.resource_type : null;

  const status =
    d.status === "pending"
      ? "Fetching the page…"
      : d.status === "failed"
        ? "Couldn't fetch this page"
        : summarizing && !d.enriched_at
          ? "Reading the page…"
          : null;

  return (
    <li
      className={`group grid gap-x-8 border-t border-rule py-5 lg:grid-cols-[9rem_minmax(0,1fr)] ${
        highlight ? "bg-sheet" : ""
      } ${pending ? "opacity-50" : ""}`}
    >
      <div className="min-w-0 lg:col-start-2 lg:row-start-1">
        <div className="flex items-baseline justify-between gap-4">
          <a href={`/open/${d.id}`} target="_blank" rel="noopener noreferrer" className="font-serif text-entry font-semibold hover:underline">
            {title}
          </a>
          <span className="shrink-0 text-meta text-pencil">
            <LocalDate value={d.saved_at} />
          </span>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-meta text-pencil">
          {d.favicon_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.favicon_url} alt="" width={14} height={14} className="h-3.5 w-3.5 rounded-sm" referrerPolicy="no-referrer" />
          )}
          <span>
            {d.domain}
            {kind && `, ${kind}`}
          </span>
        </p>
        {status && <p className={`mt-1 text-meta ${d.status === "failed" ? "text-stamp" : "text-pencil"}`}>{status}</p>}
      </div>

      {/* Why-note: margin on wide screens, inline on phones. */}
      <div className="mt-2 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:mt-1 lg:text-right">
        {editing ? (
          <form
            className="flex flex-col gap-2 lg:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                await updateWhyAction(d.id, why);
                setEditing(false);
              });
            }}
          >
            <textarea
              autoFocus
              value={why}
              maxLength={500}
              rows={3}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Why did you save this?"
              className="field font-serif italic text-pen"
            />
            <span className="flex gap-3">
              <button className="action text-ink">Save note</button>
              <button type="button" className="action" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </span>
          </form>
        ) : d.why_note ? (
          <button
            onClick={() => setEditing(true)}
            title="Edit why you saved this"
            className="text-left font-serif text-ui italic leading-snug text-pen hover:underline lg:text-right"
          >
            {d.why_note}
          </button>
        ) : null}
      </div>

      <div className="min-w-0 lg:col-start-2">
        {d.summary && <p className="mt-2 line-clamp-2 max-w-prose font-serif text-ui text-pencil">{d.summary}</p>}
        <TagList tags={d.tags} className="mt-2" />
        <div className="mt-2 flex gap-4 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <Link href={`/d/${d.id}`} className="action">
            Related
          </Link>
          {!editing && !d.why_note && (
            <button onClick={() => setEditing(true)} className="action">
              Add why
            </button>
          )}
          <button onClick={() => confirm("Delete this item?") && start(() => deleteAction(d.id))} className="action hover:text-stamp">
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}
