// Minimal service worker: makes the app installable (needed for the share
// target on some Android builds). No offline caching by design.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
