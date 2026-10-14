/* Dva formuláře pro čtenáře: zpětná vazba pod článkem a nápad na nový článek pod seznamem článků.
   Odpověď pošle funkci na stejné adrese, která ji uloží jako soubor.
   Neposílá se nic kromě toho, co čtenář vyplní, a názvu a adresy stránky. */
(() => {
  const endpoint = "/api/feedback";
  if (location.pathname.includes("/admin/")) return;

  const main = document.querySelector("main");
  if (!main) return;
  // název článku je poslední složka adresy; rozcestník žádnou vlastní nemá
  const parts = location.pathname.split("/").filter((p) => p && p !== "index.html");
  const last = parts[parts.length - 1] || "";
  const article = last || "rozcestnik";

  const style = document.createElement("style");
  style.textContent = `
    .fb { margin-top: clamp(2.5rem, 6vw, 4rem); padding: clamp(1rem, 3vw, 1.5rem); border: 1px solid var(--rule); background: var(--surface); }
    .fb h2 { margin: 0 0 0.3rem; font-family: var(--font-display); font-stretch: 108%; font-weight: 800; font-size: 1.35rem; line-height: 1.15; }
    .fb .fb-lede { margin: 0 0 1.1rem; color: var(--ink-2); font-size: 0.95rem; max-width: 40rem; }
    .fb form { display: grid; gap: 1rem; max-width: 40rem; }
    .fb .fb-field { display: grid; gap: 0.4rem; min-width: 0; }
    .fb .seg { justify-self: start; }
    .fb textarea { width: 100%; min-height: 4.6rem; padding: 0.6rem 0.7rem; border: 1px solid var(--ink-3); border-radius: 0; background: var(--paper); color: var(--ink); font: inherit; font-size: 1rem; line-height: 1.45; resize: vertical; }
    .fb textarea:focus-visible { outline: 3px solid var(--cat); outline-offset: 1px; }
    .fb .fb-trap { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
    .fb .fb-row { display: flex; flex-wrap: wrap; gap: 0.8rem 1.2rem; align-items: center; }
    .fb .fb-note { margin: 0; font-family: var(--font-mono); font-size: 0.8rem; color: var(--ink-3); }
    .fb .fb-note.bad { color: var(--bad); }
    .fb .fb-done { margin: 0; font-size: 1.05rem; }
    .hub-sec > .fb { margin-top: 0; }
    .admin-bar { border-bottom: 1px solid var(--rule); }
    .admin-bar .wrap { display: flex; justify-content: flex-end; padding-block: 0.3rem; }
    .admin-bar a { font-family: var(--font-mono); font-size: 0.75rem; color: var(--ink-3); }
    .admin-bar a:hover { color: var(--ink); }
  `;
  document.head.appendChild(style);

  // Správci, který je v tomhle prohlížeči přihlášený do administrace, ukážeme nahoře odkaz zpět do ní.
  // Cookie jvf_admin_on nastaví administrace při přihlášení a vyprší spolu s ním.
  if (document.cookie.split(/;\s*/).includes("jvf_admin_on=1")) {
    const bar = document.createElement("div");
    bar.className = "admin-bar";
    bar.innerHTML = `<div class="wrap"><a href="/admin/">Administrace</a></div>`;
    document.body.prepend(bar);
  }

  const shownAt = Date.now();
  // Pošle odpověď a formulář nahradí poděkováním; při chybě ji vypíše pod tlačítko.
  async function submit(form, note, fields, thanks) {
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    note.classList.remove("bad");
    note.textContent = "Odesílám…";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article, page: location.pathname, ...fields, website: form.website.value, elapsed: Date.now() - shownAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "");
      const done = document.createElement("p");
      done.className = "fb-done";
      done.setAttribute("role", "status");
      done.textContent = thanks;
      form.replaceWith(done);
    } catch (err) {
      button.disabled = false;
      note.classList.add("bad");
      note.textContent = err.message || "Nepodařilo se to odeslat. Zkuste to prosím za chvíli.";
    }
  }
  const complain = (note, text) => { note.classList.add("bad"); note.textContent = text; };

  // Nápad na nový článek: stránka si místo pro něj označí sama (rozcestník a stránky kategorií).
  const ideaSpot = document.querySelector('[data-form="napady"]');
  if (ideaSpot) {
    const ideas = document.createElement("section");
    ideas.className = "fb";
    ideas.setAttribute("aria-labelledby", "fb-idea-title");
    ideas.innerHTML = `
    <h2 id="fb-idea-title">Chybí vám tu něco?</h2>
    <p class="fb-lede">Napište, co byste chtěli vysvětlit.</p>
    <form novalidate>
      <div class="fb-field">
        <label class="label" for="fb-idea">Téma nebo otázka</label>
        <textarea id="fb-idea" name="idea" maxlength="1000"></textarea>
      </div>
      <div class="fb-trap" aria-hidden="true">
        <label for="fb-idea-website">Tohle pole nechte prázdné</label>
        <input type="text" id="fb-idea-website" name="website" tabindex="-1" autocomplete="off">
      </div>
      <div class="fb-row">
        <button type="submit" class="btn">Odeslat nápad</button>
        <p class="fb-note" role="status" aria-live="polite"></p>
      </div>
    </form>`;
    ideaSpot.replaceWith(ideas);
    const ideaForm = ideas.querySelector("form"), ideaNote = ideas.querySelector(".fb-note");
    ideaForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const idea = ideaForm.idea.value.trim();
      if (!idea) return complain(ideaNote, "Napište prosím aspoň pár slov.");
      submit(ideaForm, ideaNote, { idea }, "Díky, mám to zapsané.");
    });
  }

  // Zpětná vazba k tomu, co čtenář právě dočetl. Stránka kategorie je jen seznam, tam nedává smysl.
  if (document.body.dataset.page === "kategorie") return;
  const box = document.createElement("section");
  box.className = "fb";
  box.setAttribute("aria-labelledby", "fb-title");
  box.innerHTML = `
    <h2 id="fb-title">Co na to říkáte?</h2>
    <p class="fb-lede">Pomůže mi to články vylepšit. Uloží se jen to, co sem napíšete, žádné jméno ani adresa.</p>
    <form novalidate>
      <div class="fb-field">
        <span class="label" id="fb-rating-label">Bylo to srozumitelné?</span>
        <div class="seg" role="radiogroup" aria-labelledby="fb-rating-label">
          <button type="button" role="radio" data-v="ano" aria-checked="false">Ano</button>
          <button type="button" role="radio" data-v="zcasti" aria-checked="false">Zčásti</button>
          <button type="button" role="radio" data-v="ne" aria-checked="false">Ne</button>
        </div>
      </div>
      <div class="fb-field">
        <label class="label" for="fb-liked">Co se vám líbilo</label>
        <textarea id="fb-liked" name="liked" maxlength="2000"></textarea>
      </div>
      <div class="fb-field">
        <label class="label" for="fb-missing">Co vám chybělo nebo nedávalo smysl</label>
        <textarea id="fb-missing" name="missing" maxlength="2000"></textarea>
      </div>
      <div class="fb-trap" aria-hidden="true">
        <label for="fb-website">Tohle pole nechte prázdné</label>
        <input type="text" id="fb-website" name="website" tabindex="-1" autocomplete="off">
      </div>
      <div class="fb-row">
        <button type="submit" class="btn">Odeslat</button>
        <p class="fb-note" role="status" aria-live="polite"></p>
      </div>
    </form>`;
  const foot = main.querySelector(".art-foot");
  if (foot) main.insertBefore(box, foot); else main.appendChild(box);

  const form = box.querySelector("form"), note = box.querySelector(".fb-note"), seg = box.querySelector(".seg");
  let rating = "";
  seg.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-v]");
    if (!b) return;
    // druhé kliknutí na stejnou volbu ji zase zruší
    rating = rating === b.dataset.v ? "" : b.dataset.v;
    seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x.dataset.v === rating)));
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const liked = form.liked.value.trim(), missing = form.missing.value.trim();
    if (!rating && !liked && !missing) return complain(note, "Vyberte aspoň jednu odpověď nebo něco napište.");
    submit(form, note, { rating, liked, missing }, "Díky, dostal jsem to.");
  });
})();
