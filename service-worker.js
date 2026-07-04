// service-worker.js
// Cache "shell" aplikasi (HTML/CSS/JS statis) agar app tetap bisa terbuka
// walau sinyal internet lemah. Data Firestore (siswa, kas, absensi) TETAP
// butuh koneksi internet karena real-time database, service worker ini
// tidak meng-cache data tersebut.

const CACHE_NAME = "bmi-taekwondo-shell-v1";
const APP_SHELL = [
  "./index.html",
  "./manifest.json"
];

// Saat SW pertama kali diinstall -> simpan file shell ke cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Saat SW aktif -> hapus cache versi lama kalau ada
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Strategi: coba ambil dari network dulu (biar data selalu fresh),
// kalau gagal (offline) baru pakai cache shell.
self.addEventListener("fetch", (event) => {
  // Biarkan request ke Firebase/Firestore & CDN eksternal lewat langsung (jangan di-intercept)
  if (event.request.method !== "GET" || event.request.url.startsWith("chrome-extension")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // update cache shell setiap ada request berhasil ke file sendiri
        if (event.request.url.includes(self.location.origin)) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
