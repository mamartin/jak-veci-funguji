import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Odkud smí formulář posílat odpovědi: z tohohle webu samotného, případně z adres v ALLOWED_ORIGINS.
// Jiný web je nepošle, ani kdyby okopíroval celý formulář.
const ALLOWED = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
function sameSite(req, origin) {
  try { return new URL(origin).host === (req.headers["x-forwarded-host"] || req.headers.host); } catch { return false; }
}

export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

// Vrátí hlavičky pro prohlížeč, když požadavek přišel z povoleného webu, jinak null.
export function cors(req) {
  const origin = req.headers.origin || "";
  if (!ALLOWED.includes(origin) && !sameSite(req, origin)) return null;
  return { "Access-Control-Allow-Origin": origin, Vary: "Origin", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" };
}

// Přečte tělo požadavku jako JSON. Vercel ho někdy rozebere sám, lokální server ne.
export async function readJson(req, limit = 16000) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  let text = typeof req.body === "string" ? req.body : Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  if (!text) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) throw new Error("too-large");
      chunks.push(chunk);
    }
    text = Buffer.concat(chunks).toString("utf8");
  }
  if (text.length > limit) throw new Error("too-large");
  return JSON.parse(text || "{}");
}

// Porovná heslo s heslem v nastavení projektu tak, aby se z doby odpovědi nedalo nic vyčíst.
export function passwordOk(given) {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (expected.length < 8 || typeof given !== "string") return false;
  const a = createHash("sha256").update(given).digest(), b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/* Přihlášení do administrace: po zadání hesla dostane prohlížeč podepsaný klíč s datem vypršení.
   Leží v cookie, kterou čte jen server (HttpOnly) a kterou prohlížeč posílá jen funkcím v /api.
   Vedle ní je obyčejná cookie jvf_admin_on se stejnou platností; podle ní stránky webu poznají,
   že mají ukázat odkaz do administrace. Heslo se v prohlížeči neukládá. */
export const SESSION_DAYS = 30;
const SESSION = "jvf_admin", FLAG = "jvf_admin_on";
// podpisový klíč je odvozený z hesla: když se heslo změní, všechna přihlášení přestanou platit
const sign = (payload) => createHmac("sha256", createHash("sha256").update(`jvf-session:${process.env.ADMIN_PASSWORD || ""}`).digest()).update(payload).digest("base64url");
const cookies = (value, flag, age) => [
  `${SESSION}=${value}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`,
  `${FLAG}=${flag}; Path=/; Secure; SameSite=Lax; Max-Age=${age}`,
];
export function startSession() {
  const until = Date.now() + SESSION_DAYS * 86400000, payload = Buffer.from(JSON.stringify({ until })).toString("base64url");
  return { until, cookies: cookies(`${payload}.${sign(payload)}`, "1", SESSION_DAYS * 86400) };
}
export const endSession = () => cookies("", "", 0);
// do kdy platí přihlášení z cookie (milisekundy), nebo 0
export function session(req) {
  const raw = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(`${SESSION}=`));
  const [payload, sig] = raw ? raw.slice(SESSION.length + 1).split(".") : [];
  if (!payload || !sig) return 0;
  const good = Buffer.from(sign(payload)), got = Buffer.from(sig);
  if (good.length !== got.length || !timingSafeEqual(good, got)) return 0;
  try { const { until } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); return until > Date.now() ? until : 0; } catch { return 0; }
}

// Správce se prokáže přihlašovací cookie, nebo heslem v hlavičce (to se hodí pro skripty).
export function isAdmin(req) {
  if ((process.env.ADMIN_PASSWORD || "").length < 8) return false;
  if (session(req)) return true;
  const auth = req.headers.authorization || "";
  let given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!given) return false;
  // heslo s háčky a čárkami musí být v hlavičce zakódované
  try { given = decodeURIComponent(given); } catch { /* nezakódované heslo se porovná tak, jak přišlo */ }
  return passwordOk(given);
}
