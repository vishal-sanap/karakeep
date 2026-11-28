"use client";
import { useActionState } from "react";
import { shareSaveAction, type SaveState } from "@/app/actions";

export function ShareForm({ url }: { url: string }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(shareSaveAction, {});
  return (
    <form action={action} className="space-y-3">
      <input
        name="url"
        type="url"
        required
        defaultValue={url}
        placeholder="https://…"
        aria-label="Link to save"
        className="field"
      />
      <input
        name="why_note"
        autoFocus
        maxLength={500}
        placeholder="Why are you saving it? (optional)"
        aria-label="Why you're saving it"
        className="field font-serif italic text-pen placeholder:font-sans placeholder:not-italic"
      />
      <button
        disabled={pending}
        className="btn w-full"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error && <p className="text-ui text-stamp">{state.error}</p>}
    </form>
  );
}
