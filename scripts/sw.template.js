/* Service worker: celý web (rozcestník, články, styl, písma) se při instalaci uloží do mezipaměti,
   aby fungoval bez připojení. Stránky, styly a skripty se přesto berou nejdřív ze serveru, takže čtenář
   vidí vždy aktuální verzi; uložená kopie přijde na řadu, jen když je offline nebo server dlouho neodpovídá.
   Seznam souborů s otisky obsahu sem při nasazení doplní scripts/build.mjs; změní-li se jediný soubor,
   změní se i tenhle skript a prohlížeč nainstaluje novou verzi. Ta se zapne hned, bez ptaní.
   Nezměněné soubory se jen překopírují ze staré mezipaměti. */
const VERSION = "__VERSION__";
const FILES = __FILES__;
const CACHE = "jvf-" + VERSION;
const LIST_KEY = "/__seznam__";
const PATIENCE = 3000;          // jak dlouho čekat na server, než se sáhne po uložené kopii (ms)

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const reuse = new Map();
    for (const name of await caches.keys()) {
      if (!name.startsWith("jvf-") || name === CACHE) continue;
      const old = await caches.open(name);
      const list = await old.match(LIST_KEY).then((r) => r && r.json()).catch(() => null);
      if (!list) continue;
      for (const url in list) if (list[url] === FILES[url] && !reuse.has(url)) reuse.set(url, old);
    }
    await Promise.all(Object.keys(FILES).map(async (url) => {
      const old = reuse.get(url);
      const kept = old && (await old.match(url));
      if (kept) return cache.put(url, kept);
      const res = await fetch(url, { cache: "reload" });
      if (!res.ok) throw new Error("Nepodařilo se stáhnout " + url);
      await cache.put(url, plain(res));
    }));
    await cache.put(LIST_KEY, new Response(JSON.stringify(FILES), { headers: { "Content-Type": "application/json" } }));
    // nová verze nečeká, až čtenář zavře všechny záložky; rozečtená stránka zůstane, jak je, a změna se projeví při dalším kliknutí
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith("jvf-") && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/")) return;
  const key = normalize(url.pathname);
  // stránky, styly a skripty: nejdřív server; písma a obrázky se nemění, ty rovnou z mezipaměti
  const fresh = req.mode === "navigate" || /\.(css|js|webmanifest)$/.test(key) || key.endsWith("/");
  if (!fresh) return e.respondWith(cacheFirst(req, key));
  // čerstvou odpověď uložit i tehdy, když stránka mezitím dostala uloženou kopii;
  // přesměrování a chyby se neukládají, jen řádná odpověď z našeho webu
  let saved = Promise.resolve();
  const network = fetch(req).then((res) => {
    if (res.ok && res.type === "basic" && !res.redirected) { const copy = res.clone(); saved = caches.open(CACHE).then((c) => c.put(key, copy)); }
    return res;
  });
  e.waitUntil(network.then(() => saved).catch(() => {}));
  e.respondWith(networkFirst(req, key, network));
});

async function networkFirst(req, key, network) {
  const late = new Promise((resolve) => setTimeout(resolve, PATIENCE));
  try {
    const res = await Promise.race([network, late]);
    if (res) return res;
  } catch { /* bez připojení: zkusí se uložená kopie */ }
  const hit = await (await caches.open(CACHE)).match(key);
  if (hit) return hit;
  try { return await network; } catch (err) {
    if (req.mode === "navigate") return offline();
    throw err;
  }
}

async function cacheFirst(req, key) {
  const hit = await (await caches.open(CACHE)).match(key);
  return hit || fetch(req);
}

// /clanky/zamek i /clanky/zamek/index.html jsou v mezipaměti jako /clanky/zamek/
function normalize(path) {
  path = path.replace(/index\.html$/, "");
  if (!/\.[a-z0-9]+$/i.test(path) && !path.endsWith("/")) path += "/";
  return path;
}

// Odpověď po přesměrování nejde použít pro navigaci, proto se tělo přebalí
function plain(res) {
  if (!res.redirected) return res;
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

function offline() {
  return new Response(
    `<!doctype html><html lang="cs"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Bez připojení</title><body style="margin:0;display:grid;place-items:center;min-height:100vh;font:1.1rem/1.5 Georgia,serif;background:#f1f2ed;color:#14181e"><main style="padding:2rem;max-width:30rem"><h1 style="font-family:system-ui,sans-serif">Jste bez připojení</h1><p>Tahle stránka zatím není uložená v telefonu. Zkuste to znovu, až budete online, nebo se vraťte na <a href="/" style="color:inherit">přehled témat</a>.</p></main>`,
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
