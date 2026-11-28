import { getSettings, originPattern, setSettings } from "./storage";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const baseUrl = $<HTMLInputElement>("baseUrl");
const token = $<HTMLInputElement>("token");
const statusEl = $<HTMLParagraphElement>("status");

void getSettings().then((s) => {
  if (s) {
    baseUrl.value = s.baseUrl;
    token.value = s.token;
  }
});

$<HTMLFormElement>("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = baseUrl.value.trim().replace(/\/+$/, "");
  // Ask for host permission on the app's origin only (granted from a user gesture).
  const granted = await chrome.permissions.request({ origins: [originPattern(url)] });
  if (!granted) {
    statusEl.textContent = "The extension needs permission to reach this address.";
    statusEl.className = "status err";
    return;
  }
  await setSettings({ baseUrl: url, token: token.value.trim() });
  statusEl.textContent = "Connected. You can save pages now.";
  statusEl.className = "status ok";
});
