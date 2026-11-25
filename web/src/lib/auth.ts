import { supabaseServer } from "./supabase/server";
import { userIdForToken } from "./tokens";

/** Session user from Supabase cookies (web app). */
export async function sessionUserId(): Promise<string | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** API auth: `Authorization: Bearer unf_...` (extension) or session cookie (web). */
export async function requestUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return userIdForToken(auth.slice(7).trim());
  }
  return sessionUserId();
}
