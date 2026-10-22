/*
 * Service worker KawanKu: syarat aplikasi bisa dipasang (PWA) di sebagian
 * browser HP, plus halaman "sedang offline" saat tidak ada internet.
 * Sengaja TIDAK menyimpan halaman/data aplikasi (berisi data jamaah dan
 * sesi login): semua permintaan tetap langsung ke server.
 */
const CACHE = "kawanku-v1";
const OFFLINE = "/offline.html";
const ASET = [OFFLINE, "/icons/icon-192.png", "/brand/mark.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.allSettled(ASET.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nama) => Promise.all(nama.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Hanya navigasi halaman yang ditangani: gagal jaringan → halaman offline.
  if (req.mode !== "navigate") return;
  event.respondWith(fetch(req).catch(() => caches.match(OFFLINE).then((r) => r || Response.error())));
});
