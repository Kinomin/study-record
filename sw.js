/* ============================================================
   Service Worker
   役割は「アプリの画面を端末に保存して、通信なしで開けるようにする」
   ことだけ。記録の中身には一切触れない。外部への送信も行わない。

   キャッシュ対象は同一ディレクトリの自分のファイルのみ。
   外部ドメインへのリクエストは、そもそも発生しない。
   ============================================================ */
const VERSION = "v8";
const CACHE = `study-shell-${VERSION}`;

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png",
  "./favicon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;

  // 自分の置き場所の外は扱わない
  if (new URL(req.url).origin !== self.location.origin) return;
  if (req.method !== "GET") return;

  // キャッシュ優先。通信できなくても必ず開ける状態を保つ。
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) {
        // 裏側で静かに更新する（失敗しても表示には影響しない）
        fetch(req).then(res => {
          if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
        }).catch(() => {});
        return hit;
      }
      return fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
