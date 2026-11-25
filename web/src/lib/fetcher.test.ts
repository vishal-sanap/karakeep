import { describe, expect, it } from "vitest";
import { isBlockedAddress, safeFetch, FetchBlockedError } from "./fetcher";

process.env.DATABASE_URL ??= "postgres://x@localhost/x";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://x.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "x";

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1", "10.0.0.5", "172.16.3.4", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "224.0.0.1",
  ])("blocks %s", (ip) => expect(isBlockedAddress(ip)).toBe(true));

  it.each(["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"])("allows %s", (ip) =>
    expect(isBlockedAddress(ip)).toBe(false),
  );
});

describe("safeFetch", () => {
  it.each([
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://localhost:3000/",
    "http://[::1]/",
    "https://example.com:8443/",
    "ftp://example.com/",
  ])("refuses %s before connecting", async (url) => {
    await expect(safeFetch(url)).rejects.toBeInstanceOf(FetchBlockedError);
  });
});
