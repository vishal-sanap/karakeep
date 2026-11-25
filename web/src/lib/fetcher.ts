import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";
import ipaddr from "ipaddr.js";
import { Agent, fetch } from "undici";
import { env } from "./env";

/**
 * SSRF-hardened fetch for user-supplied URLs.
 *
 * - http/https only, default ports only
 * - every resolved address (initial + each redirect) is checked at *connect*
 *   time via a custom DNS lookup, so DNS rebinding can't slip past the check
 * - redirects followed manually, re-validated, capped
 * - response size and total time capped
 */

const MAX_REDIRECTS = 5;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

export class FetchBlockedError extends Error {}

export function isBlockedAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return true;
  let addr = ipaddr.parse(address);
  if (addr.kind() === "ipv6" && (addr as ipaddr.IPv6).isIPv4MappedAddress()) {
    addr = (addr as ipaddr.IPv6).toIPv4Address();
  }
  // Only globally routable unicast is allowed. This rejects private, loopback,
  // link-local (incl. 169.254.169.254 cloud metadata), CGNAT, multicast,
  // reserved, unique-local, 6to4/teredo etc.
  return addr.range() !== "unicast";
}

const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = addresses as LookupAddress[];
    const bad = list.find((a) => isBlockedAddress(a.address));
    if (bad || list.length === 0) {
      return callback(new FetchBlockedError(`Blocked address for ${hostname}`), "", 4);
    }
    if ((options as { all?: boolean }).all) {
      return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
    }
    callback(null, list[0].address, list[0].family);
  });
};

const agent = new Agent({
  connect: { lookup: safeLookup, timeout: 5_000 },
  headersTimeout: TIMEOUT_MS,
  bodyTimeout: TIMEOUT_MS,
});

function assertAllowedUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchBlockedError(`Blocked protocol ${url.protocol}`);
  }
  if (url.port && !((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443"))) {
    throw new FetchBlockedError(`Blocked port ${url.port}`);
  }
  if (url.username || url.password) throw new FetchBlockedError("Credentials in URL");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (ipaddr.isValid(host) && isBlockedAddress(host)) {
    throw new FetchBlockedError(`Blocked address ${host}`);
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new FetchBlockedError(`Blocked host ${host}`);
  }
}

export type SafeResponse = {
  finalUrl: URL;
  status: number;
  contentType: string;
  body: string; // decoded text, truncated to MAX_BYTES
};

export async function safeFetch(input: string | URL, accept = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5"): Promise<SafeResponse> {
  const deadline = AbortSignal.timeout(TIMEOUT_MS);
  let url = new URL(input.toString());

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertAllowedUrl(url);
    const res = await fetch(url, {
      dispatcher: agent,
      redirect: "manual",
      signal: deadline,
      headers: { "user-agent": env().FETCH_USER_AGENT, accept, "accept-language": "en;q=1, *;q=0.5" },
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      await res.body?.cancel();
      url = new URL(res.headers.get("location")!, url);
      continue;
    }

    const contentType = res.headers.get("content-type") ?? "";
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES * 4) {
      await res.body?.cancel();
      return { finalUrl: url, status: res.status, contentType, body: "" };
    }

    const chunks: Uint8Array[] = [];
    let size = 0;
    if (res.body) {
      const reader = res.body.getReader();
      while (size < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.byteLength;
      }
      await reader.cancel().catch(() => {});
    }
    const buf = Buffer.concat(chunks).subarray(0, MAX_BYTES);
    const charset = /charset=([\w-]+)/i.exec(contentType)?.[1] ?? "utf-8";
    let body: string;
    try {
      body = new TextDecoder(charset).decode(buf);
    } catch {
      body = new TextDecoder("utf-8").decode(buf);
    }
    return { finalUrl: url, status: res.status, contentType, body };
  }
  throw new FetchBlockedError("Too many redirects");
}
