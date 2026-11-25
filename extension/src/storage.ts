export type Settings = { baseUrl: string; token: string };

export async function getSettings(): Promise<Settings | null> {
  const { baseUrl, token } = await chrome.storage.local.get(["baseUrl", "token"]);
  return typeof baseUrl === "string" && typeof token === "string" && baseUrl && token
    ? { baseUrl, token }
    : null;
}

export async function setSettings(s: Settings) {
  await chrome.storage.local.set(s);
}

/** Origin pattern for host permission, e.g. https://app.example.com/* */
export function originPattern(baseUrl: string) {
  const u = new URL(baseUrl);
  return `${u.protocol}//${u.hostname}/*`;
}
