"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionUserId } from "@/lib/auth";
import { capture, CaptureError, setWhyNote } from "@/lib/capture";
import {
  cachedExplanation,
  deleteAllData,
  deleteDiscovery,
  dismissRelation,
  getPair,
  saveExplanation,
} from "@/lib/discoveries";
import { explainRelation, RefusalError, SummariesDisabledError } from "@/lib/ai/claude";
import { z } from "zod";
import { createApiToken, revokeApiToken } from "@/lib/tokens";
import { supabaseServer } from "@/lib/supabase/server";

async function requireUser() {
  const userId = await sessionUserId();
  if (!userId) redirect("/login");
  return userId;
}

export type SaveState = { error?: string; savedId?: string };

export async function saveAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const userId = await requireUser();
  try {
    const d = await capture(userId, {
      url: String(form.get("url") ?? ""),
      why_note: String(form.get("why_note") ?? ""),
    });
    revalidatePath("/");
    return { savedId: d.id };
  } catch (err) {
    if (err instanceof CaptureError) return { error: err.message };
    console.error("[saveAction]", err);
    return { error: "Couldn't save that. Check the URL and try again." };
  }
}

export async function shareSaveAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const result = await saveAction(_prev, form);
  if (result.savedId) redirect(`/?saved=${result.savedId}`);
  return result;
}

export async function updateWhyAction(id: string, whyNote: string) {
  const userId = await requireUser();
  await setWhyNote(userId, id, whyNote);
  revalidatePath("/");
  revalidatePath(`/d/${id}`);
}

const uuid = z.string().uuid();

export type ExplainState = { explanation?: string; error?: string };

/** "Why are these related?": generated on first open, then served from the cache. */
export async function explainRelationAction(id: string, otherId: string): Promise<ExplainState> {
  const userId = await requireUser();
  if (!uuid.safeParse(id).success || !uuid.safeParse(otherId).success || id === otherId) return { error: "Not found." };
  const cached = await cachedExplanation(userId, id, otherId);
  if (cached) return { explanation: cached };
  const p = await getPair(userId, id, otherId);
  if (!p) return { error: "Not found." };
  try {
    const explanation = await explainRelation(p.a, p.b);
    await saveExplanation(userId, id, otherId, explanation, p.similarity);
    return { explanation };
  } catch (err) {
    if (err instanceof SummariesDisabledError) return { error: "Explanations need an Anthropic API key." };
    if (err instanceof RefusalError) return { error: "Couldn't explain this connection." };
    console.error("[explain]", err);
    return { error: "Couldn't explain this right now. Try again." };
  }
}

/** "Not related": hide this pair for good. */
export async function dismissRelationAction(id: string, otherId: string) {
  const userId = await requireUser();
  if (!uuid.safeParse(id).success || !uuid.safeParse(otherId).success || id === otherId) return;
  if (!(await getPair(userId, id, otherId))) return;
  await dismissRelation(userId, id, otherId);
  revalidatePath(`/d/${id}`);
}

export async function deleteAction(id: string) {
  const userId = await requireUser();
  await deleteDiscovery(userId, id);
  revalidatePath("/");
}

export type TokenState = { token?: string };

export async function createTokenAction(): Promise<TokenState> {
  const userId = await requireUser();
  const { token } = await createApiToken(userId);
  revalidatePath("/settings");
  return { token };
}

export async function revokeTokenAction(id: string) {
  const userId = await requireUser();
  await revokeApiToken(userId, id);
  revalidatePath("/settings");
}

export async function deleteAllAction(form: FormData) {
  const userId = await requireUser();
  if (form.get("confirm") !== "delete") return;
  await deleteAllData(userId);
  revalidatePath("/");
  redirect("/settings?deleted=1");
}

export async function signOutAction() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
