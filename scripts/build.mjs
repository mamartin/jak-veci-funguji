// Vyrobí sw.js: do šablony scripts/sw.template.js doplní seznam souborů webu s otisky obsahu.
// Spouští se při nasazení na Vercelu (buildCommand ve vercel.json); lokální server ho volá za běhu.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export async function buildServiceWorker(root) {
  const files = {};
  const add = async (url, file) => {
    const hash = createHash("sha256").update(await readFile(join(root, file))).digest("hex").slice(0, 12);
    files[url] = hash;
  };
  await add("/", "index.html");
  // kategorie jsou složky v kořeni s index.html, články složky v nich
  const skip = new Set(["admin", "api", "fonts", "node_modules", "scripts"]);
  const dirs = async (dir) => (await readdir(join(root, dir), { withFileTypes: true })).filter((d) => d.isDirectory() && !d.name.startsWith(".") && !skip.has(d.name)).map((d) => d.name).sort();
  for (const cat of await dirs("")) {
    if (!existsSync(join(root, cat, "index.html"))) continue;
    await add(`/${cat}/`, `${cat}/index.html`);
    for (const slug of await dirs(cat)) {
      if (existsSync(join(root, cat, slug, "index.html"))) await add(`/${cat}/${slug}/`, `${cat}/${slug}/index.html`);
    }
  }
  for (const f of ["style.css", "app.js", "feedback.js", "manifest.webmanifest", "icon.svg"]) await add("/" + f, f);
  for (const f of (await readdir(join(root, "fonts"))).filter((f) => f.endsWith(".woff2")).sort()) await add("/fonts/" + f, "fonts/" + f);

  const template = await readFile(join(here, "sw.template.js"), "utf8");
  const version = createHash("sha256").update(JSON.stringify(files)).update(template).digest("hex").slice(0, 12);
  return template.replace("__VERSION__", version).replace("__FILES__", JSON.stringify(files, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(here, "..");
  const sw = await buildServiceWorker(root);
  await writeFile(join(root, "sw.js"), sw);
  console.log(`sw.js: verze ${sw.match(/VERSION = "(\w+)"/)[1]}, ${Object.keys(JSON.parse(sw.match(/FILES = (\{[\s\S]*?\n\});/)[1])).length} souborů`);
}
