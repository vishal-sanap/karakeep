"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
export function BulkImport({ initialFile, initialText = "" }: { initialFile?: File | null; initialText?: string } = {}) {
  const [text, setText] = useState(initialText);
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

  // A file dropped on the capture box arrives here pre-selected.
  useEffect(() => {
    if (initialFile) void onFile(initialFile);
  }, [initialFile]);

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
        className="field"
        aria-label="Links to import"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => fileRef.current?.click()} className="btn-quiet">
          Choose a file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,.html,.htm,.json,text/plain,text/csv,text/html,application/json"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <span className="text-meta text-pencil">A .txt or .csv list, browser bookmarks (.html), or an unfold export (.json)</span>
      </div>
      <input
        value={why}
        onChange={(e) => setWhy(e.target.value)}
        maxLength={500}
        placeholder="Why are you saving these? (optional, for links without their own note)"
        aria-label="Why you're saving these links"
        className="field font-serif italic text-pen placeholder:font-sans placeholder:not-italic"
      />

      {parsed && (
        <p className="text-ui text-pencil">
          Found <strong>{count}</strong> link{count === 1 ? "" : "s"}
          {fileName && <> in {fileName}</>} ({FORMAT_LABEL[parsed.format]})
          {parsed.duplicates > 0 && <>, {parsed.duplicates} duplicate{parsed.duplicates === 1 ? "" : "s"} removed</>}.
          {parsed.truncated && <span className="text-stamp"> Only the first {MAX_IMPORT} will be imported; import the rest separately.</span>}
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
        className="btn"
      >
        {pending ? `Importing ${count}…` : `Import ${count || ""} link${count === 1 ? "" : "s"}`.replace("  ", " ")}
      </button>

      {result &&
        (result.error ? (
          <p className="text-ui text-stamp">{result.error}</p>
        ) : (
          <p className="text-ui text-pen">
            Added {result.added}
            {result.existing > 0 && `, ${result.existing} already in your library`}
            {result.invalid > 0 && `, ${result.invalid} skipped (not valid links)`}. Titles and summaries fill in over the next
            minute or so.
          </p>
        ))}
    </div>
  );
}
