// Renders every email template with sample data into ./email-previews/*.html (nothing is sent).
// Usage: node scripts/preview-emails.mjs [folder]   then open the files in a browser.
import fs from "node:fs";
import path from "node:path";
import { emails } from "./email-samples.mjs";

const out = path.resolve(process.argv[2] || "email-previews");
fs.mkdirSync(out, { recursive: true });

for (const [name, email] of Object.entries(emails)) {
  if (!email) throw new Error(`template ${name} returned nothing`);
  fs.writeFileSync(path.join(out, `${name}.html`), email.html);
  fs.writeFileSync(path.join(out, `${name}.txt`), `Subject: ${email.subject}\n\n${email.text}\n`);
}
fs.writeFileSync(
  path.join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Gabla emails</title><body style="font-family:system-ui;max-width:640px;margin:30px auto"><h1>Gabla emails</h1><ul>${Object.entries(emails).map(([n, e]) => `<li><a href="${n}.html">${n}</a> — ${e.subject.replace(/</g, "&lt;")}</li>`).join("")}</ul>`
);
console.log(`${Object.keys(emails).length} emails written to ${out}`);
