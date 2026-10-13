/* Společné chování webu jako aplikace: instalace service workeru a hláška o nové verzi,
   označení článku za přečtený, zapamatovaná pozice čtení. Vše zůstává jen v prohlížeči. */
(() => {
  if (location.pathname.includes("/admin/")) return;

  // adresy: / je rozcestník, /<kategorie>/ stránka kategorie, /<kategorie>/<slug>/ článek
  const path = location.pathname.replace(/index\.html$/, "");
  const segs = path.split("/").filter(Boolean);
  const slug = segs.length === 2 ? segs[1] : null;
  const isHub = segs.length === 0;
  const isList = segs.length <= 1;
  const main = document.querySelector("main");
  // slug článku z odkazu na kartě nebo v seznamu témat (odkazy jsou relativní, proto přes pathname)
  const slugOf = (a) => {
    const s = a.pathname.split("/").filter(Boolean);
    return s.length === 2 ? s[1] : null;
  };

  const store = {
    get(key, fallback) {
      try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    },
  };
  const KEY_READ = "jvf:prectene",
    KEY_POS = "jvf:pozice",
    KEY_LAST = "jvf:posledni";
  const readMap = () => store.get(KEY_READ, {});
  const dateCs = (t) =>
    new Date(t).toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    });

  /* ---------- hlášky dole na obrazovce ---------- */
  let toastBox;
  function toast(text, actions = [], { sticky = false } = {}) {
    toastBox?.remove();
    toastBox = document.createElement("div");
    toastBox.className = "toast";
    toastBox.setAttribute("role", "status");
    const p = document.createElement("p");
    p.textContent = text;
    toastBox.append(p);
    for (const { label, onClick, primary } of actions) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = primary ? "btn" : "toast-x";
      b.textContent = label;
      b.addEventListener("click", () => {
        onClick?.();
        if (!primary) toastBox.remove();
      });
      toastBox.append(b);
    }
    document.body.append(toastBox);
    if (!sticky) setTimeout(() => toastBox?.remove(), 6000);
    return toastBox;
  }

  /* ---------- pozice čtení: jen u článků, po dočtení nebo označení se zapomene ---------- */
  const positions = store.get(KEY_POS, {});
  // úklid po starších verzích, které si pamatovaly i rozcestník a staré adresy
  for (const k of Object.keys(positions)) {
    const s = k.split("/").filter(Boolean);
    if (s.length !== 2 || s[0] === "clanky") delete positions[k];
  }
  store.set(KEY_POS, positions);

  if (slug)
    (() => {
      const saved = positions[path];
      // konec článku = patička článku se dostala do zorného pole (pod ní je už jen formulář)
      const atEnd = () => {
        const foot = main?.querySelector(".art-foot");
        return foot
          ? foot.getBoundingClientRect().top < innerHeight
          : scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
      };
      if (saved > 0 && !location.hash) {
        scrollTo(0, saved);
        // po načtení písem se stránka může posunout; dokud čtenář sám nepohne, pozice se srovná znovu
        let moved = false;
        for (const ev of ["wheel", "touchstart", "keydown", "pointerdown"])
          addEventListener(
            ev,
            () => {
              moved = true;
            },
            { once: true, passive: true }
          );
        const again = () => {
          if (!moved) scrollTo(0, saved);
        };
        addEventListener("load", again, { once: true });
        document.fonts?.ready.then(again);
      }
      let timer = 0;
      const save = () => {
        timer = 0;
        const all = store.get(KEY_POS, {});
        if (atEnd() || readMap()[slug]) delete all[path];
        else all[path] = Math.round(scrollY);
        store.set(KEY_POS, all);
        const h1 = document.querySelector("h1");
        store.set(KEY_LAST, {
          slug,
          href: path,
          title: h1 ? h1.textContent.trim() : slug,
          t: Date.now(),
        });
      };
      addEventListener(
        "scroll",
        () => {
          if (!timer) timer = setTimeout(save, 400);
        },
        { passive: true }
      );
      addEventListener("pagehide", save);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") save();
      });
    })();

  /* ---------- přečtené články: tlačítko v článku ---------- */
  if (slug && main) {
    const box = document.createElement("section");
    box.className = "read";
    box.setAttribute("aria-label", "Stav čtení");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn read-btn";
    const note = document.createElement("p");
    note.className = "read-note";
    box.append(btn, note);
    const foot = main.querySelector(".art-foot");
    if (foot) main.insertBefore(box, foot);
    else main.append(box);

    const render = () => {
      const when = readMap()[slug];
      btn.setAttribute("aria-pressed", String(!!when));
      btn.textContent = when ? "Přečteno" : "Označit jako přečtené";
      note.textContent = when
        ? `Označeno ${dateCs(when)}. Klepnutím označení zrušíte.`
        : "Přečtené články se v přehledu témat odliší.";
    };
    btn.addEventListener("click", () => {
      const all = readMap();
      if (all[slug]) delete all[slug];
      else all[slug] = Date.now();
      store.set(KEY_READ, all);
      render();
    });
    render();
  }

  /* ---------- přečtené články: značky na rozcestníku a v kategoriích, postup na rozcestníku ---------- */
  if (isList && main) {
    const read = readMap();
    const hrefOf = {};
    for (const a of document.querySelectorAll(".card[href], .topics a[href]")) {
      const s = slugOf(a);
      if (!s) continue;
      hrefOf[s] = a.pathname;
      if (read[s]) (a.closest("li") || a).classList.add("is-read");
    }
    const total = document.querySelectorAll(".topics a").length;
    const count = Object.keys(read).length;
    const last = store.get(KEY_LAST, null);
    const head = main.querySelector(".hub-head");
    if (isHub && head && (count || last)) {
      const bar = document.createElement("section");
      bar.className = "progress";
      bar.setAttribute("aria-label", "Vaše čtení");
      if (count) {
        const p = document.createElement("p");
        p.className = "progress-count";
        p.innerHTML = `<span class="label">Přečteno</span> <b class="num">${count}</b> <span class="of">z ${total} témat</span>`;
        const meter = document.createElement("span");
        meter.className = "meter";
        meter.innerHTML = `<i style="width:${Math.round(
          (count / total) * 100
        )}%"></i>`;
        p.append(meter);
        bar.append(p);
      }
      if (last && !read[last.slug] && hrefOf[last.slug]) {
        const a = document.createElement("a");
        a.className = "continue";
        a.href = hrefOf[last.slug];
        a.innerHTML = `<span class="label">Pokračovat ve čtení</span><span class="t"></span>`;
        a.querySelector(".t").textContent = last.title;
        bar.append(a);
      }
      if (count) bar.append(filterControl(read));
      head.after(bar);
    }
  }

  /* přepínač Vše / Nepřečtené / Přečtené; skrývá karty, položky seznamů i prázdné kategorie */
  function filterControl(read) {
    const KEY_FILTER = "jvf:filtr";
    const options = [
      ["vse", "Vše"],
      ["neprectene", "Nepřečtené"],
      ["prectene", "Přečtené"],
    ];
    const seg = document.createElement("div");
    seg.className = "filter";
    seg.setAttribute("role", "radiogroup");
    seg.setAttribute("aria-label", "Zobrazit články");
    for (const [value, label] of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.dataset.v = value;
      b.textContent = label;
      seg.append(b);
    }
    const featured = document.querySelector(".featured");
    const empty = document.createElement("p");
    empty.className = "filter-empty";
    featured?.after(empty);

    const apply = (value) => {
      seg
        .querySelectorAll("button")
        .forEach((b) =>
          b.setAttribute("aria-checked", String(b.dataset.v === value))
        );
      const show = (slug) =>
        value === "vse" || (value === "prectene") === !!read[slug];
      let visibleCards = 0;
      for (const card of document.querySelectorAll(".card[href]")) {
        const s = slugOf(card);
        if (!s) continue;
        const on = show(s);
        card.hidden = !on;
        if (on) visibleCards++;
      }
      for (const cat of document.querySelectorAll(".cat")) {
        let visible = 0;
        for (const li of cat.querySelectorAll(".topics li")) {
          const a = li.querySelector("a[href]");
          const s = a && slugOf(a);
          const on = s ? show(s) : value === "vse";
          li.hidden = !on;
          if (on) visible++;
        }
        cat.hidden = !visible;
      }
      empty.hidden = visibleCards > 0;
      empty.textContent =
        value === "prectene"
          ? "Zatím nemáte žádný článek označený jako přečtený."
          : "Všechno přečteno. Nic nepřečteného nezbývá.";
    };
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-v]");
      if (!b) return;
      store.set(KEY_FILTER, b.dataset.v);
      apply(b.dataset.v);
    });
    apply(
      options.some(([v]) => v === store.get(KEY_FILTER, "vse"))
        ? store.get(KEY_FILTER, "vse")
        : "vse"
    );
    return seg;
  }

  /* ---------- service worker: offline a nová verze ---------- */
  if (
    "serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost")
  ) {
    addEventListener("load", async () => {
      let reg;
      try {
        reg = await navigator.serviceWorker.register("/sw.js");
      } catch {
        return;
      }
      let wantReload = false;
      const offerUpdate = (sw) =>
        toast(
          "Je k dispozici nová verze.",
          [
            {
              label: "Aktualizovat",
              primary: true,
              onClick: () => {
                wantReload = true;
                sw.postMessage({ type: "SKIP_WAITING" });
              },
            },
            { label: "Později" },
          ],
          { sticky: true }
        );
      if (reg.waiting && navigator.serviceWorker.controller)
        offerUpdate(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        sw?.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller)
            offerUpdate(sw);
        });
      });
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (wantReload) location.reload();
      });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible")
          reg.update().catch(() => {});
      });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    });

    const offlineNote = () =>
      toast("Jste bez připojení, čtete uloženou verzi.", [{ label: "Zavřít" }]);
    addEventListener("offline", offlineNote);
    addEventListener("online", () => toastBox?.remove());
    if (navigator.onLine === false && navigator.serviceWorker.controller)
      addEventListener("load", offlineNote, { once: true });
  }
})();
