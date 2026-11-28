// عامل الخدمة: يحفظ واجهة المنصة وصورها على الجهاز لتفتح بسرعة، وتعمل صفحاتها دون إنترنت.
// لا يحفظ الفيديوهات (حجمها كبير، وتُبث عند المشاهدة). وبيانات المهارات يحفظها Firestore نفسه.
const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const MEDIA = `media-${VERSION}`;
const MEDIA_LIMIT = 300;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icons/icon-192.png"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, ASSETS, MEDIA].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(k);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Firestore وFirebase Auth وغيرها: كما هي

  // الصفحة: من الشبكة أولاً (لتصل التحديثات)، ومن النسخة المحفوظة دون اتصال
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // ملفات الواجهة: أسماؤها تتغير مع كل تحديث، فتُحفظ مرة واحدة
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSETS).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // الفيديوهات والصوت: تُبث من الشبكة دائماً
  if (req.headers.has("range") || /\.(mp4|webm|mp3|m4a)$/i.test(url.pathname)) return;

  // الصور والملصقات والترجمات: من الجهاز فوراً، وتُحدَّث في الخلفية
  if (url.pathname.startsWith("/media/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(MEDIA).then(async (cache) => {
        const hit = await cache.match(req);
        const net = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone()).then(() => trim(MEDIA, MEDIA_LIMIT));
            return res;
          })
          .catch(() => hit);
        return hit || net;
      }),
    );
  }
});
