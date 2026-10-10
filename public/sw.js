/*
 * Service worker на „Къде Да“.
 * - Страниците (HTML) и заявките към сървъра НИКОГА не се кешират — докладите са лични и актуални.
 * - Само статичните файлове (икони, шрифтове, хеширани /assets/*) се кешират за по-бързо зареждане.
 * - При липса на интернет, отваряне на страница показва /offline.html.
 * Вдигни CACHE_VERSION, когато променяш този файл или precache списъка.
 */
const CACHE_VERSION = "v2";
// Хешираните файлове от стари внедрявания не се трупат безкрайно — пазят се последните N.
const MAX_ASSETS = 60;
const STATIC_CACHE = `kadeda-static-${CACHE_VERSION}`;
const PRECACHE = [
  "/offline.html",
  "/icon-192.png",
  "/icon-512.png",
  "/logo-icon.png",
  "/favicon-32x32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("kadeda-static-") && k !== STATIC_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimAssets(cache) {
  const keys = await cache.keys();
  const assets = keys.filter((k) => new URL(k.url).pathname.startsWith("/assets/"));
  // Ключите са в реда на добавяне: най-старите отиват първи.
  await Promise.all(
    assets.slice(0, Math.max(0, assets.length - MAX_ASSETS)).map((k) => cache.delete(k)),
  );
}

const STATIC_FILE = /\.(?:png|jpg|jpeg|svg|ico|webp|woff2?|webmanifest)$/i;

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, Google шрифтове и т.н. — без намеса.
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/")) return;

  // Отваряне на страница: винаги от мрежата; офлайн — страницата „Няма връзка“.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html").then((r) => r ?? Response.error())),
    );
    return;
  }

  // Хеширани файлове от билда — неизменни, от кеша.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
          void trimAssets(cache);
        }
        return response;
      }),
    );
    return;
  }

  // Икони, шрифтове и др. — от кеша, а в фонов режим се освежават.
  if (STATIC_FILE.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached ?? Response.error());
        return cached ?? network;
      }),
    );
  }
});
