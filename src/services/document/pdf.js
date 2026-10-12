import { createRequire } from "module";
import path from "path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

// Renders quotations and receipts as A4 PDFs from a stored snapshot (see document.service.js). Layout follows
// the common shape of professional business documents: branded header with the document title, number and
// dates on the right; "prepared for" and "details" cards; an itemised table; totals with the grand total
// highlighted; payment details and terms; a signature line; and a footer with page numbers.

const require = createRequire(import.meta.url);
const fontDir = path.dirname(require.resolve("@fontsource/inter/package.json"));
const FONT = {
  regular: path.join(fontDir, "files", "inter-latin-400-normal.woff"),
  medium: path.join(fontDir, "files", "inter-latin-500-normal.woff"),
  semibold: path.join(fontDir, "files", "inter-latin-600-normal.woff"),
  bold: path.join(fontDir, "files", "inter-latin-700-normal.woff")
};

const PAGE = { width: 595.28, height: 841.89, margin: 44 };
const CONTENT = PAGE.width - PAGE.margin * 2;
const INK = "#0f172a";
const MUTED = "#64748b";
const FAINT = "#94a3b8";
const LINE = "#e2e8f0";
const CARD = "#f6f8fb";
const GREEN = "#15803d";

const fmtMoney = (value, currency = "UGX") => {
  const n = Number(value) || 0;
  const hasCents = Math.abs(n - Math.round(n)) > 0.004;
  return `${currency} ${n.toLocaleString("en-US", { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 })}`;
};

const EAT_MS = 3 * 3600 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (value) => {
  if (!value) return "";
  const d = new Date(new Date(value).getTime() + EAT_MS);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

// "1,250,000" -> "One million two hundred fifty thousand" (UGX has no minor unit in practice).
const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const below1000 = (n) => {
  const parts = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ""));
  else if (n > 0) parts.push(ONES[n]);
  return parts.join(" ");
};
export const amountInWords = (value, currencyName = "Uganda shillings") => {
  let n = Math.round(Number(value) || 0);
  if (n === 0) return `Zero ${currencyName} only`;
  const scales = [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"]];
  const parts = [];
  for (const [size, name] of scales) {
    if (n >= size) {
      parts.push(`${below1000(Math.floor(n / size))} ${name}`);
      n %= size;
    }
  }
  if (n > 0) parts.push(below1000(n));
  const sentence = parts.join(" ");
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)} ${currencyName} only`;
};

// Fetches the business logo; PDFKit can place PNG and JPEG only, anything else falls back to a monogram.
const fetchLogo = async (url) => {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const isPng = buf.subarray(0, 4).toString("hex") === "89504e47";
    const isJpg = buf.subarray(0, 3).toString("hex") === "ffd8ff";
    return isPng || isJpg ? buf : null;
  } catch {
    return null;
  }
};

const hexToRgb = (hex) => {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "0b2046";
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
// Readable text colour (white or ink) on a given background.
const onColor = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? INK : "#ffffff";
};

export const renderDocumentPdf = async (snapshot) => {
  const isReceipt = snapshot.type === "receipt";
  const brand = snapshot.brand || {};
  const accent = /^#[0-9a-f]{6}$/i.test(brand.accentColor) ? brand.accentColor : "#0b2046";
  const accentText = onColor(accent);
  const currency = snapshot.currency || "UGX";
  const options = snapshot.options || {};
  const [logo, qr] = await Promise.all([
    fetchLogo(brand.logoUrl),
    options.showQrCode !== false && snapshot.viewUrl ? QRCode.toBuffer(snapshot.viewUrl, { width: 220, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } }) : null
  ]);

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: PAGE.margin, bottom: PAGE.margin + 14, left: PAGE.margin, right: PAGE.margin },
    bufferPages: true,
    info: {
      Title: `${snapshot.title || (isReceipt ? "Receipt" : "Quotation")} ${snapshot.number}`,
      Author: brand.businessName || "Gabla",
      Producer: "Gabla",
      Creator: "Gabla"
    }
  });
  doc.registerFont("Regular", FONT.regular);
  doc.registerFont("Medium", FONT.medium);
  doc.registerFont("SemiBold", FONT.semibold);
  doc.registerFont("Bold", FONT.bold);

  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const finished = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = PAGE.margin;
  const right = PAGE.width - PAGE.margin;
  const bottomLimit = () => PAGE.height - PAGE.margin - 30;
  const ensure = (height) => {
    if (doc.y + height > bottomLimit()) {
      doc.addPage();
      doc.y = PAGE.margin + 6;
      return true;
    }
    return false;
  };
  const text = (value, x, y, opts = {}) => {
    doc.font(opts.font || "Regular").fontSize(opts.size || 9).fillColor(opts.color || INK);
    doc.text(String(value ?? ""), x, y, { width: opts.width, align: opts.align, lineGap: opts.lineGap ?? 2, characterSpacing: opts.spacing, ...(opts.height ? { height: opts.height, ellipsis: true } : {}) });
  };
  const heightOf = (value, width, font = "Regular", size = 9, lineGap = 2) => {
    doc.font(font).fontSize(size);
    return doc.heightOfString(String(value ?? ""), { width, lineGap });
  };

  // -------------------------------------------------------------------------- top accent band
  doc.rect(0, 0, PAGE.width, 8).fill(accent);

  // -------------------------------------------------------------------------- header
  const headY = 36;
  const logoSize = 54;
  if (logo) {
    try {
      doc.save();
      doc.roundedRect(left, headY, logoSize, logoSize, 10).clip();
      doc.image(logo, left, headY, { fit: [logoSize, logoSize], align: "center", valign: "center" });
      doc.restore();
    } catch {
      doc.restore();
    }
  } else {
    doc.roundedRect(left, headY, logoSize, logoSize, 10).fill(accent);
    doc.font("Bold").fontSize(24).fillColor(accentText).text((brand.businessName || "G").trim().slice(0, 1).toUpperCase(), left, headY + 15, { width: logoSize, align: "center" });
  }
  const nameX = left + logoSize + 14;
  const nameW = 270;
  text(brand.businessName || "Business name", nameX, headY + 1, { font: "Bold", size: 15, width: nameW, height: 20 });
  const contactLines = [brand.tagline, brand.address, [brand.phone, brand.email].filter(Boolean).join("  ·  "), brand.website, brand.taxId ? `TIN ${brand.taxId}` : ""].filter(Boolean);
  let cy = headY + 22;
  for (const line of contactLines.slice(0, 4)) {
    text(line, nameX, cy, { size: 8.5, color: MUTED, width: nameW, height: 11 });
    cy += 11.5;
  }

  const rightW = 190;
  const rightX = right - rightW;
  text((snapshot.title || (isReceipt ? "Payment receipt" : "Quotation")).toUpperCase(), rightX, headY - 2, { font: "Bold", size: 19, color: accent, width: rightW, align: "right", spacing: 0.6 });
  let ry = headY + 26;
  const metaRows = isReceipt
    ? [["Receipt no.", snapshot.number], ["Date", fmtDate(snapshot.issuedAt)], ...(snapshot.quotationRef ? [["Quotation", snapshot.quotationRef]] : [])]
    : [["Quotation no.", `${snapshot.number}${snapshot.revision > 1 ? ` (rev ${snapshot.revision})` : ""}`], ["Date", fmtDate(snapshot.issuedAt)], ["Valid until", fmtDate(snapshot.validUntil)]];
  for (const [label, value] of metaRows) {
    text(label, rightX, ry, { size: 8.5, color: MUTED, width: 78, align: "right" });
    text(value, rightX + 84, ry, { font: "SemiBold", size: 9, width: rightW - 84, align: "right" });
    ry += 13;
  }

  doc.y = Math.max(cy, ry, headY + logoSize) + 16;
  doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(0.7).strokeColor(LINE).stroke();
  doc.y += 16;

  // -------------------------------------------------------------------------- info cards
  const customer = snapshot.customer || {};
  const colW = (CONTENT - 14) / 2;
  const cardPad = 12;
  const preparedLines = [customer.name, customer.phone, customer.email, snapshot.deliveryAddress ? `Deliver to: ${snapshot.deliveryAddress}` : ""].filter(Boolean);
  const detailRows = [];
  detailRows.push(["Order", snapshot.orderRef || ""]);
  detailRows.push(["Fulfilment", snapshot.fulfillmentLabel || ""]);
  if (isReceipt) {
    detailRows.push(["Payment method", snapshot.payment?.methodLabel || ""]);
    if (snapshot.payment?.reference) detailRows.push(["Reference", snapshot.payment.reference]);
    detailRows.push(["Paid on", fmtDate(snapshot.payment?.paidAt || snapshot.issuedAt)]);
  } else {
    detailRows.push(["Payment", snapshot.payment?.methodLabel || "Pay on delivery"]);
    detailRows.push(["Currency", currency]);
  }
  const leftH = cardPad * 2 + 14 + preparedLines.reduce((h, l, i) => h + heightOf(l, colW - cardPad * 2, i === 0 ? "SemiBold" : "Regular", i === 0 ? 10.5 : 9) + 1, 0);
  const rightH = cardPad * 2 + 14 + detailRows.filter((r) => r[1]).length * 14;
  const cardH = Math.max(leftH, rightH, 78);
  const cardY = doc.y;
  doc.roundedRect(left, cardY, colW, cardH, 10).fill(CARD);
  doc.roundedRect(left + colW + 14, cardY, colW, cardH, 10).fill(CARD);
  text(isReceipt ? "RECEIVED FROM" : "PREPARED FOR", left + cardPad, cardY + cardPad, { font: "SemiBold", size: 7.5, color: FAINT, spacing: 1 });
  let py = cardY + cardPad + 14;
  preparedLines.forEach((line, i) => {
    text(line, left + cardPad, py, { font: i === 0 ? "SemiBold" : "Regular", size: i === 0 ? 10.5 : 9, color: i === 0 ? INK : MUTED, width: colW - cardPad * 2 });
    py += heightOf(line, colW - cardPad * 2, i === 0 ? "SemiBold" : "Regular", i === 0 ? 10.5 : 9) + 1;
  });
  text("DETAILS", left + colW + 14 + cardPad, cardY + cardPad, { font: "SemiBold", size: 7.5, color: FAINT, spacing: 1 });
  let dy = cardY + cardPad + 14;
  for (const [label, value] of detailRows) {
    if (!value) continue;
    text(label, left + colW + 14 + cardPad, dy, { size: 8.5, color: MUTED, width: 84 });
    text(value, left + colW + 14 + cardPad + 88, dy, { font: "Medium", size: 9, width: colW - cardPad * 2 - 88, height: 12 });
    dy += 14;
  }
  doc.y = cardY + cardH + 18;

  if (!isReceipt && snapshot.intro) {
    const h = heightOf(snapshot.intro, CONTENT, "Regular", 9.5, 3);
    ensure(h + 10);
    const y0 = doc.y;
    text(snapshot.intro, left, y0, { size: 9.5, color: "#334155", width: CONTENT, lineGap: 3 });
    doc.y = y0 + h + 14;
  }

  // -------------------------------------------------------------------------- items table
  const showNo = options.showItemNumbers !== false;
  const cols = { no: showNo ? 26 : 0, qty: 44, unit: 86, amount: 92 };
  cols.desc = CONTENT - cols.no - cols.qty - cols.unit - cols.amount;
  const x = { no: left, desc: left + cols.no, qty: left + cols.no + cols.desc, unit: left + cols.no + cols.desc + cols.qty, amount: left + cols.no + cols.desc + cols.qty + cols.unit };
  const drawHead = () => {
    const y = doc.y;
    doc.roundedRect(left, y, CONTENT, 24, 7).fill(accent);
    const hy = y + 8;
    const c = { font: "SemiBold", size: 7.8, color: accentText, spacing: 0.8 };
    if (showNo) text("#", x.no + 10, hy, { ...c, width: cols.no });
    text("DESCRIPTION", x.desc + (showNo ? 0 : 10), hy, { ...c, width: cols.desc });
    text("QTY", x.qty, hy, { ...c, width: cols.qty - 8, align: "right" });
    text("UNIT PRICE", x.unit, hy, { ...c, width: cols.unit - 8, align: "right" });
    text("AMOUNT", x.amount, hy, { ...c, width: cols.amount - 10, align: "right" });
    doc.y = y + 24;
  };
  drawHead();
  (snapshot.items || []).forEach((item, index) => {
    const descW = cols.desc - 12;
    const dh = heightOf(item.name, descW, "Medium", 9.5) + (item.description ? heightOf(item.description, descW, "Regular", 8) + 2 : 0);
    const rowH = Math.max(dh + 16, 30);
    if (ensure(rowH + 4)) drawHead();
    const y = doc.y;
    if (showNo) text(String(index + 1), x.no + 10, y + 9, { size: 9, color: MUTED, width: cols.no });
    text(item.name, x.desc + (showNo ? 0 : 10), y + 9, { font: "Medium", size: 9.5, width: descW });
    if (item.description) text(item.description, x.desc + (showNo ? 0 : 10), y + 9 + heightOf(item.name, descW, "Medium", 9.5) + 1, { size: 8, color: MUTED, width: descW });
    text(String(item.quantity), x.qty, y + 9, { size: 9.5, width: cols.qty - 8, align: "right" });
    text(fmtMoney(item.unitPrice, currency), x.unit, y + 9, { size: 9.5, width: cols.unit - 8, align: "right" });
    text(fmtMoney(item.total, currency), x.amount, y + 9, { font: "SemiBold", size: 9.5, width: cols.amount - 10, align: "right" });
    doc.moveTo(left, y + rowH).lineTo(right, y + rowH).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.y = y + rowH;
  });
  doc.y += 14;

  // -------------------------------------------------------------------------- totals (+ amount in words)
  const totals = snapshot.totals || {};
  const rows = [["Subtotal", fmtMoney(totals.subtotal, currency)]];
  if (Number(totals.discount) > 0) rows.push(["Discount", `- ${fmtMoney(totals.discount, currency)}`]);
  if (Number(totals.deliveryFee) > 0) rows.push(["Delivery", fmtMoney(totals.deliveryFee, currency)]);
  if (totals.tax?.enabled) rows.push([`${totals.tax.label || "VAT"} (${totals.tax.percent}%${totals.tax.inclusive ? ", included" : ""})`, fmtMoney(totals.tax.amount, currency)]);
  const totalsW = 232;
  const totalsX = right - totalsW;
  const totalsH = rows.length * 17 + 46;
  ensure(totalsH + 8);
  const ty = doc.y;
  if (options.showAmountInWords !== false) {
    const wordsW = CONTENT - totalsW - 22;
    text("AMOUNT IN WORDS", left, ty + 2, { font: "SemiBold", size: 7.5, color: FAINT, spacing: 1 });
    text(amountInWords(totals.total), left, ty + 16, { size: 9, color: "#334155", width: wordsW, lineGap: 3 });
  }
  let rowY = ty;
  for (const [label, value] of rows) {
    text(label, totalsX, rowY + 2, { size: 9, color: MUTED, width: totalsW - 110 });
    text(value, totalsX + totalsW - 110, rowY + 2, { font: "Medium", size: 9.5, width: 110, align: "right" });
    rowY += 17;
  }
  rowY += 4;
  const totalColor = isReceipt ? GREEN : accent;
  doc.roundedRect(totalsX, rowY, totalsW, 36, 9).fill(totalColor);
  text(isReceipt ? "Amount paid" : "Total", totalsX + 14, rowY + 12, { font: "SemiBold", size: 10, color: onColor(totalColor), width: 90 });
  text(fmtMoney(totals.total, currency), totalsX + 90, rowY + 10.5, { font: "Bold", size: 13.5, color: onColor(totalColor), width: totalsW - 104, align: "right" });
  rowY += 36;
  if (isReceipt) {
    text("Balance due", totalsX, rowY + 9, { size: 9, color: MUTED, width: totalsW - 110 });
    text(fmtMoney(0, currency), totalsX + totalsW - 110, rowY + 9, { font: "SemiBold", size: 9.5, color: GREEN, width: 110, align: "right" });
    rowY += 24;
  }
  doc.y = Math.max(rowY, ty + (options.showAmountInWords !== false ? 56 : 0)) + 18;

  // -------------------------------------------------------------------------- receipt: PAID stamp + thank-you
  if (isReceipt) {
    if (snapshot.thankYou) {
      const h = heightOf(snapshot.thankYou, CONTENT, "Regular", 10, 3);
      ensure(h + 20);
      const y0 = doc.y;
      text(snapshot.thankYou, left, y0, { size: 10, color: "#334155", width: CONTENT, lineGap: 3 });
      doc.y = y0 + h + 14;
    }
    ensure(90);
    const sx = right - 120;
    const sy = doc.y + 6;
    const resumeY = doc.y + 84;
    doc.save();
    doc.translate(sx + 50, sy + 32).rotate(-9);
    doc.opacity(0.9).lineWidth(2.4).roundedRect(-50, -26, 100, 52, 9).strokeColor(GREEN).stroke();
    doc.lineWidth(0.8).roundedRect(-46, -22, 92, 44, 6).strokeColor(GREEN).stroke();
    doc.font("Bold").fontSize(25).fillColor(GREEN).text("PAID", -50, -15, { width: 100, align: "center", characterSpacing: 3 });
    doc.restore();
    doc.opacity(1);
    doc.y = resumeY;
  }

  // -------------------------------------------------------------------------- payment details + terms
  const payLines = [];
  if (!isReceipt) {
    const pay = snapshot.paymentDetails || {};
    if (pay.instructions) payLines.push(pay.instructions);
    if (pay.mobileMoneyNumber) payLines.push(`Mobile money: ${pay.mobileMoneyNumber}${pay.mobileMoneyName ? ` (${pay.mobileMoneyName})` : ""}`);
    if (pay.bankDetails) payLines.push(pay.bankDetails);
  }
  const blocks = [];
  if (snapshot.note) blocks.push({ title: "NOTE FROM THE SELLER", body: snapshot.note });
  if (payLines.length) blocks.push({ title: "HOW TO PAY", body: payLines.join("\n") });
  if (!isReceipt && snapshot.terms) blocks.push({ title: "TERMS & CONDITIONS", body: snapshot.terms });
  if (isReceipt && snapshot.footerNote) blocks.push({ title: "NOTES", body: snapshot.footerNote });
  for (const block of blocks) {
    const h = heightOf(block.body, CONTENT, "Regular", 8.8, 3.2);
    ensure(h + 30);
    const y0 = doc.y;
    text(block.title, left, y0, { font: "SemiBold", size: 7.5, color: FAINT, spacing: 1 });
    text(block.body, left, y0 + 13, { size: 8.8, color: "#475569", width: CONTENT, lineGap: 3.2 });
    doc.y = y0 + 13 + h + 16;
  }

  // -------------------------------------------------------------------------- signature + QR
  const wantSignature = !isReceipt && snapshot.showSignature;
  if (wantSignature || qr) {
    ensure(70);
    const by = doc.y + 2;
    if (wantSignature) {
      doc.moveTo(left, by + 40).lineTo(left + 190, by + 40).lineWidth(0.8).strokeColor("#94a3b8").stroke();
      text(snapshot.signatoryName || "Authorised signature", left, by + 45, { font: "Medium", size: 9, width: 220 });
      text(snapshot.signatoryTitle || brand.businessName || "", left, by + 58, { size: 8, color: MUTED, width: 220 });
    }
    if (qr) {
      doc.image(qr, right - 62, by, { width: 62 });
      text(isReceipt ? "View this order online" : "Accept or view online", right - 200, by + 22, { size: 8, color: MUTED, width: 128, align: "right" });
      text("gogabla.com", right - 200, by + 34, { font: "SemiBold", size: 8, color: accent, width: 128, align: "right" });
    }
    doc.y = by + 66;
  }

  // -------------------------------------------------------------------------- footer on every page
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const fy = PAGE.height - PAGE.margin + 4;
    doc.page.margins.bottom = 0;
    doc.moveTo(left, fy - 8).lineTo(right, fy - 8).lineWidth(0.5).strokeColor(LINE).stroke();
    text(`${snapshot.title || (isReceipt ? "Payment receipt" : "Quotation")} ${snapshot.number}  ·  Page ${i + 1} of ${range.count}`, left, fy, { size: 7.8, color: FAINT, width: 300, lineGap: 0 });
    text("Issued through Gabla", right - 200, fy, { size: 7.8, color: FAINT, width: 200, align: "right", lineGap: 0 });
  }

  doc.end();
  return finished;
};

// Sample content for the live preview in the provider's settings.
export const sampleSnapshot = ({ type, brand, template, options, tax, payment, viewUrl }) => {
  const items = [
    { name: "Wireless noise-cancelling headphones", description: "Black, 1 year warranty", quantity: 1, unitPrice: 320000, total: 320000 },
    { name: "Fast charger 65W with USB-C cable", quantity: 2, unitPrice: 45000, total: 90000 },
    { name: "Delivery set-up and demo", quantity: 1, unitPrice: 25000, total: 25000 }
  ];
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const totals = computeTotals({ subtotal, discount: 0, deliveryFee: 0, tax });
  const now = new Date();
  return {
    type,
    title: type === "receipt" ? template.receipt.title : template.quotation.title,
    number: `${type === "receipt" ? template.receipt.prefix : template.quotation.prefix}-${now.getUTCFullYear()}-0042`,
    revision: 1,
    issuedAt: now.toISOString(),
    validUntil: new Date(now.getTime() + template.quotation.validityDays * 86400000).toISOString(),
    currency: "UGX",
    brand,
    options,
    customer: { name: "Aisha Namukasa", phone: "0701 100 000", email: "aisha@example.com" },
    deliveryAddress: "Plot 12, Kira Road, Kampala",
    orderRef: "#A1B2C3",
    fulfillmentLabel: "Delivery",
    payment: type === "receipt" ? { methodLabel: "Mobile money", reference: "MM-48213907", paidAt: now.toISOString() } : { methodLabel: "Pay on delivery" },
    quotationRef: type === "receipt" ? `${template.quotation.prefix}-${now.getUTCFullYear()}-0042` : undefined,
    items,
    totals,
    intro: template.quotation.intro,
    terms: template.quotation.terms,
    showSignature: template.quotation.showSignature,
    signatoryName: template.quotation.signatoryName,
    signatoryTitle: template.quotation.signatoryTitle,
    paymentDetails: payment,
    thankYou: template.receipt.thankYou,
    footerNote: template.receipt.footerNote,
    viewUrl
  };
};

export const computeTotals = ({ subtotal, discount = 0, deliveryFee = 0, tax }) => {
  const base = Math.max(0, subtotal - discount + deliveryFee);
  if (!tax?.enabled || !Number(tax.percent)) return { subtotal, discount, deliveryFee, tax: { enabled: false }, total: base };
  const pct = Number(tax.percent);
  const amount = tax.inclusive ? (base * pct) / (100 + pct) : (base * pct) / 100;
  return {
    subtotal,
    discount,
    deliveryFee,
    tax: { enabled: true, label: tax.label || "VAT", percent: pct, inclusive: Boolean(tax.inclusive), amount: Math.round(amount) },
    total: tax.inclusive ? base : base + Math.round(amount)
  };
};
