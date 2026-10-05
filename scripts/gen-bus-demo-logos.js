// Writes the SVG logo marks used by the demo bus companies (scripts/seed-demo-bus.js) into
// public_app/public/bus-demo/, so they are served by the storefront itself and need no upload.
//   node scripts/gen-bus-demo-logos.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public_app", "public", "bus-demo");
fs.mkdirSync(out, { recursive: true });

// key, monogram, background gradient [from, to], accent, motif
const BRANDS = [
  ["swift", "SS", ["#0b2046", "#1d4ed8"], "#fb923c", "chevrons"],
  ["pearl", "PC", ["#6d28d9", "#a78bfa"], "#fde68a", "arc"],
  ["nile", "NL", ["#0369a1", "#38bdf8"], "#ffffff", "waves"],
  ["rwenzori", "RX", ["#14532d", "#22c55e"], "#fef08a", "peaks"],
  ["savannah", "SC", ["#b45309", "#f59e0b"], "#451a03", "sun"],
  ["teso", "TS", ["#9f1239", "#fb7185"], "#fff1f2", "star"],
  ["kigezi", "KR", ["#1e3a8a", "#6366f1"], "#fcd34d", "crown"],
  ["acholi", "AG", ["#854d0e", "#eab308"], "#1c1917", "stripes"],
  ["elgon", "ES", ["#115e59", "#2dd4bf"], "#f0fdfa", "peaks"],
  ["buganda", "BR", ["#7f1d1d", "#ef4444"], "#fde68a", "crown"]
];

const motif = (kind, accent) => {
  switch (kind) {
    case "chevrons": return `<path d="M24 98l18-14 18 14M24 108l18-14 18 14" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;
    case "arc": return `<path d="M20 108a44 44 0 0 1 88 0" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round" opacity=".9"/>`;
    case "waves": return `<path d="M18 98q11-9 22 0t22 0 22 0 22 0M18 110q11-9 22 0t22 0 22 0 22 0" fill="none" stroke="${accent}" stroke-width="4.5" stroke-linecap="round" opacity=".85"/>`;
    case "peaks": return `<path d="M16 112l26-34 14 18 12-14 24 30z" fill="${accent}" opacity=".85"/>`;
    case "sun": return `<circle cx="64" cy="112" r="26" fill="${accent}" opacity=".35"/><path d="M24 112h80" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>`;
    case "star": return `<path d="M64 84l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill="${accent}" opacity=".9"/>`;
    case "crown": return `<path d="M30 112l-4-26 22 14 16-20 16 20 22-14-4 26z" fill="${accent}" opacity=".9"/>`;
    default: return `<path d="M16 100h96M16 110h96M16 120h96" stroke="${accent}" stroke-width="4" opacity=".6"/>`;
  }
};

for (const [key, letters, [c1, c2], accent, kind] of BRANDS) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="256" height="256" role="img" aria-label="${letters}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient><clipPath id="c"><rect width="128" height="128" rx="30"/></clipPath></defs>
<g clip-path="url(#c)"><rect width="128" height="128" fill="url(#g)"/>${motif(kind, accent)}
<text x="64" y="70" text-anchor="middle" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="44" letter-spacing="-1" fill="#fff">${letters}</text></g></svg>
`;
  fs.writeFileSync(path.join(out, `logo-${key}.svg`), svg);
}
process.stdout.write(`Wrote ${BRANDS.length} logos to ${out}\n`);
