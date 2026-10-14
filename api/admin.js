import { endSession, isAdmin, passwordOk, readJson, send, session, startSession } from "./_lib/http.js";
import { configured, listAll, MAX_LISTED, remove } from "./_lib/store.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// POST /api/admin {action: "login", password} přihlásí na 30 dní, {action: "logout"} odhlásí.
// GET /api/admin: všechny odpovědi. DELETE /api/admin?path=…: smaže jednu. Obojí jen přihlášenému.
export default async function handler(req, res) {
  if ((process.env.ADMIN_PASSWORD || "").length < 8) return send(res, 503, { error: "V nastavení projektu chybí heslo ADMIN_PASSWORD (aspoň 8 znaků)." });
  if (req.method === "POST") {
    let body;
    try { body = await readJson(req, 2000); } catch { return send(res, 400, { error: "Zprávu se nepodařilo přečíst." }); }
    if (body.action === "logout") return send(res, 200, { ok: true }, { "Set-Cookie": endSession() });
    if (body.action !== "login") return send(res, 400, { error: "Neznámá akce." });
    if (!passwordOk(body.password)) { await wait(700); return send(res, 401, { error: "Špatné heslo." }); }
    const fresh = startSession();
    return send(res, 200, { ok: true, until: fresh.until }, { "Set-Cookie": fresh.cookies });
  }
  if (!isAdmin(req)) { await wait(700); return send(res, 401, { error: "Nejste přihlášený." }); }
  if (!configured()) return send(res, 503, { error: "K projektu není připojené úložiště Blob." });
  try {
    if (req.method === "GET") {
      const items = await listAll();
      return send(res, 200, { items, limit: MAX_LISTED, until: session(req) || null });
    }
    if (req.method === "DELETE") {
      const path = new URL(req.url, "http://x").searchParams.get("path") || "";
      try { await remove(path); } catch (err) { if (err.message === "bad-path") return send(res, 400, { error: "Takový soubor tu není." }); throw err; }
      return send(res, 200, { ok: true });
    }
    send(res, 405, { error: "Jen GET, DELETE a POST." });
  } catch (err) {
    console.error("Administrace selhala:", err);
    send(res, 500, { error: "Úložiště neodpovědělo. Podrobnosti jsou v logu funkce na Vercelu." });
  }
}
