import { env } from "../config/env.js";

// The one look every Gabla email shares. Templates describe WHAT to say (a title, some paragraphs, a table of
// details, a button); this file decides how it looks. Email clients are fussy, so it is built from nested tables
// with inline styles only, no images that must load (the wordmark is text), and a plain-text twin of every email.

export const BRAND = { navy: "#0B2046", yellow: "#FACC15", blue: "#2563EB", ink: "#0F172A", muted: "#526174", faint: "#8491A3", line: "#E2E8F0", page: "#F2F5F9" };

export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const ugx = (value) => `UGX ${Number(value ?? 0).toLocaleString("en-US")}`;
export const siteUrl = (path = "") => `${env.publicSiteUrl}${path}`;

// Marks a string as already-safe HTML (everything else passed to a block is escaped).
export const raw = (html) => ({ __raw: String(html ?? "") });
const out = (value) => (value && typeof value === "object" && "__raw" in value ? value.__raw : escapeHtml(value));
const plain = (value) => (value && typeof value === "object" && "__raw" in value ? value.__raw.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&rarr;/g, "->").replace(/&nbsp;/g, " ").replace(/&middot;/g, "·").replace(/&times;/g, "x") : String(value ?? ""));

const TONES = {
  info: { bg: "#EFF6FF", border: "#BFDBFE", ink: "#1E3A8A" },
  success: { bg: "#ECFDF5", border: "#A7F3D0", ink: "#065F46" },
  warn: { bg: "#FFFBEB", border: "#FDE68A", ink: "#92400E" },
  danger: { bg: "#FEF2F2", border: "#FECACA", ink: "#991B1B" }
};

// ---------------------------------------------------------------- blocks (each returns { html, text })

export const p = (value) => ({
  html: `<p style="margin:0 0 14px;color:${BRAND.muted};font-size:15px;line-height:1.65;">${out(value)}</p>`,
  text: plain(value)
});

// A boxed list of label / value pairs.
export const details = (rows, { title } = {}) => {
  const list = rows.filter((r) => r && r[1] !== undefined && r[1] !== null && r[1] !== "");
  if (!list.length) return { html: "", text: "" };
  return {
    html: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 18px;background:#F8FAFC;border:1px solid ${BRAND.line};border-radius:12px;">
${title ? `<tr><td colspan="2" style="padding:14px 18px 6px;color:${BRAND.faint};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${out(title)}</td></tr>` : ""}
${list.map(([label, value], i) => `<tr><td valign="top" style="padding:${i === 0 && !title ? 16 : 7}px 12px ${i === list.length - 1 ? 16 : 7}px 18px;color:${BRAND.faint};font-size:13px;width:36%;">${escapeHtml(label)}</td><td valign="top" style="padding:${i === 0 && !title ? 16 : 7}px 18px ${i === list.length - 1 ? 16 : 7}px 0;color:${BRAND.ink};font-size:14px;font-weight:600;line-height:1.5;">${out(value)}</td></tr>`).join("")}
</table>`,
    text: `${title ? `${title}\n` : ""}${list.map(([l, v]) => `${l}: ${plain(v)}`).join("\n")}`
  };
};

// Order lines with a total underneath.
export const lines = (items, { totalLabel = "Total", total, totalColor } = {}) => ({
  html: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 18px;background:#F8FAFC;border:1px solid ${BRAND.line};border-radius:12px;">
${items.map((it, i) => `<tr><td style="padding:${i === 0 ? 16 : 6}px 12px 6px 18px;color:#334155;font-size:14px;">${escapeHtml(it.name)}${it.quantity ? ` <span style="color:${BRAND.faint};">&times; ${escapeHtml(it.quantity)}</span>` : ""}</td><td align="right" style="padding:${i === 0 ? 16 : 6}px 18px 6px 0;color:${BRAND.ink};font-size:14px;font-weight:600;white-space:nowrap;">${it.amount !== undefined ? escapeHtml(it.amount) : ""}</td></tr>`).join("")}
${total !== undefined ? `<tr><td style="padding:12px 12px 16px 18px;border-top:1px solid ${BRAND.line};color:${BRAND.ink};font-size:15px;font-weight:700;">${escapeHtml(totalLabel)}</td><td align="right" style="padding:12px 18px 16px 0;border-top:1px solid ${BRAND.line};color:${totalColor || BRAND.navy};font-size:19px;font-weight:800;white-space:nowrap;">${escapeHtml(total)}</td></tr>` : ""}
</table>`,
  text: `${items.map((it) => `- ${it.name}${it.quantity ? ` x${it.quantity}` : ""}${it.amount !== undefined ? ` - ${it.amount}` : ""}`).join("\n")}${total !== undefined ? `\n${totalLabel}: ${total}` : ""}`
});

export const callout = (value, tone = "info") => {
  const t = TONES[tone] || TONES.info;
  return {
    html: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 18px;"><tr><td style="padding:14px 16px;background:${t.bg};border:1px solid ${t.border};border-radius:12px;color:${t.ink};font-size:14px;line-height:1.6;">${out(value)}</td></tr></table>`,
    text: plain(value)
  };
};

export const steps = (list) => ({
  html: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 10px;">${list
    .map(
      (s, i) => `<tr><td valign="top" style="width:44px;padding:0 0 16px;"><div style="width:34px;height:34px;border-radius:9px;background:${["#FFF4B8", "#DFF5F1", "#E6EEF9"][i % 3]};color:${BRAND.navy};text-align:center;line-height:34px;font-weight:800;">${i + 1}</div></td><td valign="top" style="padding:1px 0 16px 4px;"><strong style="display:block;color:${BRAND.ink};font-size:14px;">${escapeHtml(s.title)}</strong><span style="display:block;margin-top:3px;color:#64748B;font-size:13px;line-height:1.55;">${escapeHtml(s.body)}</span></td></tr>`
    )
    .join("")}</table>`,
  text: list.map((s, i) => `${i + 1}. ${s.title} - ${s.body}`).join("\n")
});

// Anything template-specific (a bus ticket, a QR code): supply the html and a text twin yourself.
export const custom = (html, text = "") => ({ html, text });

// ---------------------------------------------------------------- the frame

const button = (cta) =>
  `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:8px auto 4px;"><tr><td align="center" style="border-radius:10px;background:${cta.color || BRAND.navy};"><a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:15px 28px;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:700;line-height:1;">${escapeHtml(cta.label)}&nbsp;&nbsp;&rarr;</a></td></tr></table>`;

// `accent` re-colours the top band (documents use the seller's colour). `badge` is the little pill over the title.
export const renderEmail = ({ subject, preheader = "", badge, badgeTone = "info", title, intro, blocks = [], cta, ctaNote, hero, accent, footer, sender }) => {
  const tone = TONES[badgeTone] || TONES.info;
  const bodyBlocks = [...(intro ? [p(intro)] : []), ...blocks.filter(Boolean)];
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.page};font-family:-apple-system,'Segoe UI',Roboto,Arial,Helvetica,sans-serif;color:${BRAND.ink};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.page};">
<tr><td align="center" style="padding:28px 12px 36px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
  <tr><td style="padding:0 6px 16px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
      <td align="center" valign="middle" style="width:38px;height:38px;background:${BRAND.navy};border-radius:10px;color:${BRAND.yellow};font-size:22px;font-weight:800;">G</td>
      <td style="padding-left:10px;color:${BRAND.navy};font-size:22px;font-weight:800;letter-spacing:-0.01em;">Gabla</td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#FFFFFF;border:1px solid ${BRAND.line};border-radius:18px;overflow:hidden;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr><td style="height:6px;background:${accent || BRAND.yellow};font-size:0;line-height:0;">&nbsp;</td></tr>
      ${hero ? `<tr><td align="center" style="padding:26px 30px 0;"><img src="${escapeHtml(hero.url)}" width="${hero.width || 340}" alt="${escapeHtml(hero.alt || "")}" style="display:block;width:100%;max-width:${hero.width || 340}px;height:auto;border:0;"></td></tr>` : ""}
      <tr><td style="padding:${hero ? 18 : 30}px 34px 6px;">
        ${badge ? `<div style="display:inline-block;padding:5px 12px;border-radius:999px;background:${tone.bg};border:1px solid ${tone.border};color:${tone.ink};font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;">${escapeHtml(badge)}</div>` : ""}
        <h1 style="margin:${badge ? 14 : 0}px 0 14px;color:${BRAND.navy};font-size:26px;line-height:1.25;font-weight:800;letter-spacing:-0.01em;">${escapeHtml(title)}</h1>
        ${bodyBlocks.map((b) => b.html).join("\n")}
      </td></tr>
      ${cta ? `<tr><td style="padding:6px 34px ${ctaNote ? 6 : 34}px;">${button(cta)}</td></tr>` : ""}
      ${ctaNote ? `<tr><td align="center" style="padding:6px 34px 30px;color:${BRAND.faint};font-size:12px;line-height:1.6;">${escapeHtml(ctaNote)}</td></tr>` : ""}
    </table>
  </td></tr>
  <tr><td align="center" style="padding:22px 18px 0;color:${BRAND.faint};font-size:12px;line-height:1.7;">
    ${sender ? `${escapeHtml(sender)}<br>` : ""}${escapeHtml(footer || "You are receiving this email because of activity on your Gabla account.")}
    <br><span style="color:${BRAND.navy};font-weight:700;">Gabla</span> &middot; Helping people find trusted shops, services and rides across Uganda.
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    title,
    "",
    ...(intro ? [plain(intro), ""] : []),
    ...blocks.filter(Boolean).map((b) => `${b.text}\n`),
    ...(cta ? [`${cta.label}: ${cta.url}`, ""] : []),
    ...(ctaNote ? [ctaNote, ""] : []),
    "-- Gabla"
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { subject, html, text };
};
