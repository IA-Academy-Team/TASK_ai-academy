const CACHE = "ai-academy-shell-v1";
const SHELL_ASSETS = [
  "/static/brand/logo.png",
  "/static/brand/favicon.png",
  "/static/brand/icon-192.png",
  "/static/brand/icon-512.png",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

// Solo cachea assets estáticos (logo, iconos, manifest). Las páginas y datos
// de la app siempre van a red: es un dashboard con datos vivos, cachear HTML
// mostraría tareas/proyectos desactualizados.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (
    url.origin !== self.location.origin ||
    !url.pathname.startsWith("/static/")
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});
