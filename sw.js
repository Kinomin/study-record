/* ============================================================
   Service Worker

   役割は「アプリの画面を端末に保存して、通信なしでも開ける
   ようにする」ことだけ。記録の中身には一切触れない。
   外部への送信も行わない。

   方針：
   - 画面（HTML）は「まず通信、だめなら保存済み」。
     こうしないと、ファイルを差し替えても古い画面が残り続ける。
   - 画像などは「まず保存済み、無ければ通信」。滅多に変わらない
     ため、速さを優先する。
   ============================================================ */
const VERSION = "v10";
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
      .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", e => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

function isHTML(req) {
  if (req.mode === "navigate") return true;
  const a = req.headers.get("accept") || "";
  if (a.includes("text/html")) return true;
  return /\.html$/.test(new URL(req.url).pathname);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (new URL(req.url).origin !== self.location.origin) return;
  if (req.method !== "GET") return;

  // 画面：まず通信。失敗したときだけ保存済みを返す。
  if (isHTML(req)) {
    e.respondWith(
      fetch(req, { cache: "no-store" })
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => {
              c.put("./index.html", copy.clone());
              c.put("./", copy);
            });
          }
          return res;
        })
        .catch(() =>
          caches.match(req, { ignoreSearch: true })
            .then(hit => hit || caches.match("./index.html"))
        )
    );
    return;
  }

  // それ以外：まず保存済み。裏で静かに更新する。
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) {
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
