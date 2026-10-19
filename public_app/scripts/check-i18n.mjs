// Usage: node scripts/check-i18n.mjs [--fix-none]
// Verifies (1) every language has exactly the same keys as English, (2) every literal t("a.b.c") in src
// exists in English (plural keys count via their _one/_other forms). Dynamic keys (template strings) are skipped.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../src");
const langs = ["en", "ti", "so", "lg"];

const flatten = (obj, prefix = "", out = new Set()) => {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object") flatten(v, `${prefix}${k}.`, out);
    else out.add(`${prefix}${k}`);
  }
  return out;
};

const load = (lang) => {
  const dir = path.join(root, "i18n/locales", lang);
  const keys = new Set();
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    for (const k of flatten(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))) {
      if (keys.has(k)) console.error(`DUPLICATE key across files in ${lang}: ${k}`);
      keys.add(k);
    }
  }
  return keys;
};

let bad = 0;
const sets = Object.fromEntries(langs.map((l) => [l, load(l)]));
for (const l of langs.slice(1)) {
  for (const k of sets.en) if (!sets[l].has(k)) { console.error(`[${l}] missing: ${k}`); bad++; }
  for (const k of sets[l]) if (!sets.en.has(k)) { console.error(`[${l}] extra: ${k}`); bad++; }
}

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? (e.name === "i18n" ? [] : walk(path.join(dir, e.name))) : /\.(jsx?|mjs)$/.test(e.name) ? [path.join(dir, e.name)] : []);
const has = (k) => sets.en.has(k) || sets.en.has(`${k}_one`) || sets.en.has(`${k}_other`) || sets.en.has(`${k}_zero`);
for (const file of walk(root)) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/\bt\(\s*["']([A-Za-z0-9_.]+)["']/g)) {
    if (!has(m[1])) { console.error(`${path.relative(root, file)}: unknown key ${m[1]}`); bad++; }
  }
}
console.log(bad ? `\n${bad} problem(s)` : "i18n OK");
process.exit(bad ? 1 : 0);
