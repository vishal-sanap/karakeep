"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionUserId } from "@/lib/auth";
import { capture, CaptureError } from "@/lib/capture";
import { deleteAllData, deleteDiscovery, updateWhyNote } from "@/lib/discoveries";
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
  await updateWhyNote(userId, id, whyNote.trim().slice(0, 500) || null);
  revalidatePath("/");
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
