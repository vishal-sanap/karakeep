"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { importLinksAction, type ImportResult } from "@/app/actions";
import { MAX_IMPORT, parseLinks, type ParseResult } from "@/lib/bulk";

const FORMAT_LABEL: Record<ParseResult["format"], string> = {
  json: "unfold export",
  bookmarks: "browser bookmarks",
  text: "text",
};

/**
 * Paste a list of links (any text: one per line, CSV, an email...) or pick a
 * .txt / .csv / bookmarks .html / unfold .json file. Parsed in the browser;
 * the server saves each link through the normal path.
 */
export function BulkImport() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [why, setWhy] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => (text.trim() ? parseLinks(text, fileName) : null), [text, fileName]);
  const count = parsed?.entries.length ?? 0;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      setResult({ added: 0, existing: 0, invalid: 0, error: "That file is over 20 MB." });
      return;
    }
    setFileName(f.name);
    setText(await f.text());
    setResult(null);
  };

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setFileName("");
          setResult(null);
        }}
        rows={6}
        placeholder={"Paste links here, one per line, or any text that contains them.\nhttps://example.com/article\nhttps://another.site/post"}
        className="w-full rounded-lg border border-stone-300 bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-stone-500 dark:border-stone-700"
      />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-md border border-stone-300 px-3 py-1 hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          Choose a file…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,.html,.htm,.json,text/plain,text/csv,text/html,application/json"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <span className="text-xs text-stone-500">.txt, .csv, browser bookmarks (.html) or an unfold export (.json)</span>
      </div>
      <input
        value={why}
        onChange={(e) => setWhy(e.target.value)}
        maxLength={500}
        placeholder="Why? (optional, added to links that don't have their own note)"
        className="w-full rounded-lg border border-stone-300 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-stone-500 dark:border-stone-700"
      />

      {parsed && (
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Found <strong>{count}</strong> link{count === 1 ? "" : "s"}
          {fileName && <> in {fileName}</>} ({FORMAT_LABEL[parsed.format]})
          {parsed.duplicates > 0 && <>, {parsed.duplicates} duplicate{parsed.duplicates === 1 ? "" : "s"} removed</>}.
          {parsed.truncated && <span className="text-amber-600"> Only the first {MAX_IMPORT} will be imported; run the rest separately.</span>}
        </p>
      )}

      <button
        disabled={!count || pending}
        onClick={() =>
          start(async () => {
            setResult(null);
            const r = await importLinksAction(parsed!.entries, why);
            setResult(r);
            if (!r.error) {
              setText("");
              setFileName("");
              if (fileRef.current) fileRef.current.value = "";
            }
          })
        }
        className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-stone-100 dark:text-stone-900"
      >
        {pending ? `Importing ${count}…` : `Import ${count || ""} link${count === 1 ? "" : "s"}`.replace("  ", " ")}
      </button>

      {result &&
        (result.error ? (
          <p className="text-sm text-red-600">{result.error}</p>
        ) : (
          <p className="text-sm text-emerald-600">
            Added {result.added}
            {result.existing > 0 && `, ${result.existing} already in your library`}
            {result.invalid > 0 && `, ${result.invalid} skipped (not valid links)`}. Titles and summaries fill in over the next
            minute or so.
          </p>
        ))}
    </div>
  );
}
