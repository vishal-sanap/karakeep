"use client";
import { useActionState, useEffect, useRef } from "react";
import { saveAction, type SaveState } from "@/app/actions";

export function SaveForm() {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.savedId) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <label htmlFor="save-url" className="sr-only">
        Link to save
      </label>
      <div className="flex gap-2">
        <input id="save-url" name="url" type="url" required placeholder="Paste a link to save" className="field" />
        <button disabled={pending} className="btn shrink-0">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <label htmlFor="save-why" className="sr-only">
        Why you&apos;re saving it
      </label>
      <input
        id="save-why"
        name="why_note"
        maxLength={500}
        placeholder="Why are you saving it? (optional)"
        className="field font-serif italic text-pen placeholder:font-sans placeholder:not-italic"
      />
      {state.error && <p className="text-ui text-stamp">{state.error}</p>}
      <a href="/settings#import" className="action inline-block">
        Import many links at once
      </a>
    </form>
  );
}
