import { createHash, randomBytes } from "node:crypto";
import { sql } from "./db";

const PREFIX = "unf_";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Create a token; the plaintext is returned once and never stored. */
export async function createApiToken(userId: string, name = "Chrome extension") {
  const token = PREFIX + randomBytes(32).toString("base64url");
  const [row] = await sql()`
    insert into api_token (user_id, name, token_hash)
    values (${userId}, ${name}, ${hashToken(token)})
    returning id, name, created_at`;
  return { token, ...row };
}

export async function userIdForToken(token: string): Promise<string | null> {
  if (!token.startsWith(PREFIX)) return null;
  const rows = await sql()`
    update api_token set last_used_at = now()
    where token_hash = ${hashToken(token)}
    returning user_id`;
  return rows[0]?.user_id ?? null;
}

export async function listApiTokens(userId: string) {
  return sql()<{ id: string; name: string; created_at: Date; last_used_at: Date | null }[]>`
    select id, name, created_at, last_used_at from api_token
    where user_id = ${userId} order by created_at desc`;
}

export async function revokeApiToken(userId: string, id: string) {
  await sql()`delete from api_token where id = ${id} and user_id = ${userId}`;
}
