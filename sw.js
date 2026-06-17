// Service worker minimale per Eventi Ferrara.
// Strategia NETWORK-FIRST: online si vede sempre la versione aggiornata;
// la cache serve solo da fallback offline per lo "scheletro" dell'app.
// (Scelta voluta: il sito cambia spesso, evitiamo di servire versioni vecchie.)
const CACHE = "eventi-ferrara-v1";
const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./utils.js",
  "./app.js",
  "./assets/IMG_1411.jpeg",
  "./assets/icon-192.png",
  "./manifest.webmanifest"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // gestiamo solo GET http(s) dello stesso sito; Firebase/CDN passano diretti alla rete
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
