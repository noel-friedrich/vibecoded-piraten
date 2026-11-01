const CACHE = "pi-raten-v6-gallery";
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.webmanifest",
  "./js/app.js",
  "./js/gallery.js",
  "./js/audio.js",
  "./js/camera.js",
  "./js/effects.js",
  "./js/game.js",
  "./js/leaderboard.js",
  "./js/pi.js",
  "./js/storage.js",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/audio/five-armies.mp3",
  "./assets/audio/CREDITS.txt",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
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
            .filter((key) => key.startsWith("pi-raten-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
// Safari requests audio byte ranges. Serve these from the complete cached file offline.
async function rangeResponse(request, response) {
  const range = request.headers.get("range");
  if (!range) return response;
  const bytes = await response.arrayBuffer();
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2]))
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${bytes.byteLength}` },
    });
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, bytes.byteLength - Number(match[2]));
  const end =
    match[1] && match[2]
      ? Math.min(Number(match[2]), bytes.byteLength - 1)
      : bytes.byteLength - 1;
  if (start > end || start >= bytes.byteLength)
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${bytes.byteLength}` },
    });
  return new Response(bytes.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "audio/mpeg",
      "Content-Range": `bytes ${start}-${end}/${bytes.byteLength}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request.url, { ignoreSearch: true });
      if (cached) return rangeResponse(request, cached);
      try {
        return await fetch(request);
      } catch (error) {
        if (request.mode === "navigate") return cache.match("./index.html");
        throw error;
      }
    })(),
  );
});
