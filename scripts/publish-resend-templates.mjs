// Publishes every Gabla email as a template in your Resend account (Resend dashboard -> Templates), so they can be
// seen and edited there. The app sends through them by alias (see src/emails/mailer.js) and falls back to the in-code
// copy if a template is missing, so running this is safe to repeat: existing templates are updated in place.
//
//   RESEND_API_KEY=re_xxx node scripts/publish-resend-templates.mjs          # shows what it would do
//   RESEND_API_KEY=re_xxx node scripts/publish-resend-templates.mjs --apply  # creates / updates and publishes
//
// The key is read from the environment only and is never written anywhere.
import { emails } from "./email-samples.mjs";
import { TOKEN_KEYS, frame, tokens } from "../src/emails/kit.js";

const key = process.env.RESEND_API_KEY;
const apply = process.argv.includes("--apply");
if (!key) {
  console.error("Set RESEND_API_KEY in the environment first.");
  process.exit(1);
}

const api = async (method, path, body) => {
  const response = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, json };
};

const prettyName = (alias) => `Gabla · ${alias.replace(/^gabla-/, "").replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase())}`;
const html = frame(tokens()).replace("<title>Gabla</title>", "<title>Gabla</title>");

// Existing templates by alias, so a second run updates instead of duplicating.
const existing = new Map();
if (apply) {
  let after;
  for (let page = 0; page < 20; page += 1) {
    const r = await api("GET", `/templates?limit=100${after ? `&after=${after}` : ""}`);
    if (!r.ok) break;
    for (const t of r.json.data || []) if (t.alias) existing.set(t.alias, t.id);
    if (!r.json.has_more || !r.json.data?.length) break;
    after = r.json.data[r.json.data.length - 1].id;
  }
}

let failures = 0;
for (const [name, email] of Object.entries(emails)) {
  const alias = email.alias;
  const payload = {
    name: prettyName(alias),
    alias,
    subject: email.subject,
    html,
    variables: TOKEN_KEYS.map((k) => ({ key: k, type: "string", fallbackValue: email.variables[k] }))
  };
  if (!apply) {
    console.log(`would publish ${alias.padEnd(34)} (${name})`);
    continue;
  }
  let id = existing.get(alias);
  let r;
  if (id) {
    const { alias: _a, ...patch } = payload;
    r = await api("PATCH", `/templates/${id}`, patch);
  } else {
    r = await api("POST", "/templates", payload);
    id = r.json.id;
  }
  if (!r.ok) {
    failures += 1;
    console.log(`FAILED  ${alias}: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
    continue;
  }
  const published = await api("POST", `/templates/${id}/publish`);
  if (!published.ok) {
    failures += 1;
    console.log(`FAILED to publish ${alias}: ${published.status} ${JSON.stringify(published.json).slice(0, 200)}`);
    continue;
  }
  console.log(`${existing.has(alias) ? "updated  " : "created  "} ${alias}`);
}
if (apply) console.log(failures ? `${failures} failed` : "all templates are published");
