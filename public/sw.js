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

// Notifikasi HP (Web Push): pengingat pengajian dari server.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { isi: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.judul || "KawanKu", {
      body: data.isi || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || undefined,
      lang: "id",
      data: { url: data.url || "/saya" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/saya", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((daftar) => {
      for (const c of daftar) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
