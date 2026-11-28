import { getSettings, type Settings } from "./storage";

export class NotConfiguredError extends Error {}
export class TokenRejectedError extends Error {}

export type SaveResult = { created: boolean; settings: Settings };

/** Save a URL (and optional note) to unfold with the stored app URL + token. Shared by popup and right-click. */
export async function saveToUnfold(url: string, whyNote?: string | null): Promise<SaveResult> {
  const settings = await getSettings();
  if (!settings) throw new NotConfiguredError("Set your app address and token in the extension options.");
  const res = await fetch(new URL("/api/discoveries", settings.baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${settings.token}` },
    body: JSON.stringify({ url, why_note: whyNote?.trim().slice(0, 500) || null }),
  });
  if (res.status === 401) throw new TokenRejectedError("Your token was rejected. Create a new one in unfold's Settings.");
  if (!res.ok) throw new Error(`unfold couldn't save this (error ${res.status}).`);
  const body = (await res.json()) as { created: boolean };
  return { created: body.created, settings };
}

export const canSave = (url: string | undefined) => Boolean(url && /^https?:\/\//.test(url));

/** A highlighted passage as a note: quoted, single-spaced, within the 500-character limit. */
export function selectionAsNote(text: string | undefined | null): string | null {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const quoted = `“${t}”`;
  return quoted.length > 500 ? `“${t.slice(0, 496).trimEnd()}…”` : quoted;
}
