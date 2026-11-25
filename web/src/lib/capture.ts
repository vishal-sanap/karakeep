import { z } from "zod";
import { saveDiscovery, updateWhyNote } from "./discoveries";
import { enqueueEnrich, enqueueMetadata } from "./queue";
import { parseHttpUrl } from "./url";
import { sql } from "./db";

export const captureInput = z.object({
  url: z.string().min(1).max(4096),
  why_note: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
});

export class CaptureError extends Error {}

/** One-action save: insert (or dedupe), return immediately, enrich in the background. */
export async function capture(userId: string, input: z.input<typeof captureInput>) {
  const { url: raw, why_note } = captureInput.parse(input);
  const url = parseHttpUrl(raw);
  if (!url) throw new CaptureError("Only http(s) URLs can be saved");

  const discovery = await saveDiscovery(userId, url, why_note);

  if (discovery.created || discovery.status === "failed") {
    if (discovery.status === "failed") {
      await sql()`update discovery set status = 'pending' where id = ${discovery.id}`;
      discovery.status = "pending";
    }
    try {
      await enqueueMetadata(discovery.id);
    } catch (err) {
      // The worker's sweep picks up stale pending items; the save still succeeded.
      console.error("[capture] enqueue failed", err);
    }
  }
  return discovery;
}

/** Edit the why-note, then refresh the embedding (it includes the note) in the background. */
export async function setWhyNote(userId: string, id: string, whyNote: string | null) {
  const note = whyNote?.trim().slice(0, 500) || null;
  if (!(await updateWhyNote(userId, id, note))) return false;
  try {
    await enqueueEnrich(id);
  } catch (err) {
    console.error("[why-note] re-embed enqueue failed", err);
  }
  return true;
}
