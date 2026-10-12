import { Prisma } from "@prisma/client";

import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { DEFAULT_SETTINGS, mergeSettings, resolveSettings, settingsSchema } from "./document/defaults.js";
import { computeTotals, renderDocumentPdf, sampleSnapshot } from "./document/pdf.js";
import { DocumentEmailService } from "./document/documentEmail.service.js";

const bad = (message, code, statusCode = 400) => new AppError({ message, statusCode, code });
const num = (value) => Number(value?.toString?.() ?? value ?? 0) || 0;
const pad = (n, width = 4) => String(n).padStart(width, "0");
const shortRef = (orderId) => `#${String(orderId).slice(-6).toUpperCase()}`;

const methodLabel = (order) => {
  if (order.transactionId) return "Mobile money";
  return order.metadata?.paymentStatus === "paid_cash" ? "Cash" : "Pay on delivery";
};

// Quotations and receipts for orders. A quotation goes to the buyer when an order is placed unpaid; a receipt
// goes out as soon as the order is paid (mobile money, or cash collected on delivery). Providers shape how
// both look from their profile. Documents are stored as snapshots, so they never change after being sent.
export class DocumentService {
  constructor({ emailService = new DocumentEmailService() } = {}) {
    this.emailService = emailService;
  }

  // ------------------------------------------------------------------ settings
  async _provider(providerId) {
    const provider = await prisma.provider.findUnique({ where: { id: providerId }, include: { documentSettings: true } });
    if (!provider) throw bad("Provider not found", "PROVIDER_NOT_FOUND", 404);
    return provider;
  }

  async providerForUser(userId) {
    const provider = await prisma.provider.findUnique({ where: { userId } });
    if (!provider) throw bad("Provider not found", "PROVIDER_NOT_FOUND", 404);
    return provider;
  }

  async getSettings(providerId) {
    const provider = await this._provider(providerId);
    return { settings: resolveSettings(provider, provider.documentSettings?.settings), defaults: DEFAULT_SETTINGS };
  }

  async updateSettings(providerId, patch) {
    const { value, error } = settingsSchema.validate(patch, { abortEarly: false, stripUnknown: true });
    if (error) throw bad(error.details[0].message, "DOCUMENT_SETTINGS_INVALID");
    const provider = await this._provider(providerId);
    const stored = mergeSettings(provider.documentSettings?.settings || {}, value);
    await prisma.documentSettings.upsert({
      where: { providerId },
      update: { settings: stored },
      create: { providerId, settings: stored }
    });
    return this.getSettings(providerId);
  }

  // A PDF of sample content in the (possibly unsaved) template, for the live preview while editing.
  async previewPdf(providerId, { type = "quotation", settings }) {
    const provider = await this._provider(providerId);
    const { value, error } = settingsSchema.validate(settings || {}, { stripUnknown: true });
    if (error) throw bad(error.details[0].message, "DOCUMENT_SETTINGS_INVALID");
    const template = resolveSettings(provider, mergeSettings(provider.documentSettings?.settings || {}, value));
    const snapshot = sampleSnapshot({
      type: type === "receipt" ? "receipt" : "quotation",
      brand: template.brand,
      template,
      options: template.options,
      tax: template.tax,
      payment: template.payment,
      viewUrl: `${env.publicSiteUrl}/orders`
    });
    return renderDocumentPdf(snapshot);
  }

  // ------------------------------------------------------------------ issuing
  async _nextNumber(providerId, type, prefix) {
    const field = type === "receipt" ? "nextReceiptNo" : "nextQuoteNo";
    await prisma.documentSettings.upsert({ where: { providerId }, update: {}, create: { providerId, settings: {} } });
    const row = await prisma.documentSettings.update({ where: { providerId }, data: { [field]: { increment: 1 } } });
    const seq = row[field] - 1;
    return `${prefix}-${new Date().getUTCFullYear()}-${pad(seq)}`;
  }

  async _orderContext(orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, user: { select: { email: true, name: true, phone: true } }, transaction: true } });
    if (!order) throw bad("Order not found", "ORDER_NOT_FOUND", 404);
    const provider = await this._provider(order.providerId);
    return { order, provider, template: resolveSettings(provider, provider.documentSettings?.settings) };
  }

  _buyer(order) {
    const c = order.customer || {};
    return { name: c.name || order.user?.name || "Customer", phone: c.phone || order.user?.phone || "", email: c.email || order.user?.email || "" };
  }

  _lines(order) {
    return order.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: num(i.unitPrice), total: num(i.total) }));
  }

  _base({ order, provider, template, type }) {
    const fulfillment = order.fulfillment || {};
    return {
      type,
      brand: template.brand,
      options: template.options,
      currency: "UGX",
      customer: this._buyer(order),
      orderRef: shortRef(order.id),
      deliveryAddress: fulfillment.method === "delivery" ? fulfillment.address || "" : "",
      fulfillmentLabel: fulfillment.method === "delivery" ? "Delivery" : fulfillment.method === "pickup" ? "Pickup" : "",
      items: this._lines(order),
      viewUrl: `${env.publicSiteUrl}/orders`,
      providerName: provider.businessName
    };
  }

  async _store({ order, provider, userId, type, number, revision, snapshot, total }) {
    return prisma.orderDocument.create({
      data: { orderId: order.id, providerId: provider.id, userId: userId ?? order.userId ?? null, type, number, revision, total: new Prisma.Decimal(total), snapshot }
    });
  }

  // Issues a quotation for an order, or a new revision of it when the seller changes delivery, discount or
  // notes. Earlier revisions stay on record as superseded.
  async issueQuotation({ orderId, adjustments = {}, send = true, actingProviderId = null }) {
    const { order, provider, template } = await this._orderContext(orderId);
    if (actingProviderId && order.providerId !== actingProviderId) throw bad("Order not found", "ORDER_NOT_FOUND", 404);
    if (order.metadata?.paymentStatus === "paid_cash" || order.transactionId) throw bad("This order is already paid, so it gets a receipt instead of a quotation.", "ORDER_ALREADY_PAID", 409);

    const previous = await prisma.orderDocument.findFirst({ where: { orderId, type: "quotation" }, orderBy: [{ revision: "desc" }, { createdAt: "desc" }] });
    const number = previous?.number ?? (await this._nextNumber(provider.id, "quotation", template.quotation.prefix));
    const revision = previous ? previous.revision + 1 : 1;

    const subtotal = this._lines(order).reduce((s, i) => s + i.total, 0);
    const discount = Math.max(0, Math.min(subtotal, num(adjustments.discount)));
    const deliveryFee = Math.max(0, num(adjustments.deliveryFee));
    const validityDays = Math.max(1, Math.min(365, Math.round(num(adjustments.validityDays)) || template.quotation.validityDays));
    const issuedAt = new Date();
    const snapshot = {
      ...this._base({ order, provider, template, type: "quotation" }),
      title: template.quotation.title,
      number,
      revision,
      issuedAt: issuedAt.toISOString(),
      validUntil: new Date(issuedAt.getTime() + validityDays * 86400000).toISOString(),
      payment: { methodLabel: methodLabel(order) },
      totals: computeTotals({ subtotal, discount, deliveryFee, tax: template.tax }),
      intro: template.quotation.intro,
      terms: template.quotation.terms,
      note: String(adjustments.note ?? "").trim().slice(0, 600),
      showSignature: template.quotation.showSignature,
      signatoryName: template.quotation.signatoryName,
      signatoryTitle: template.quotation.signatoryTitle,
      paymentDetails: template.payment
    };
    const doc = await this._store({ order, provider, type: "quotation", number, revision, snapshot, total: snapshot.totals.total });
    if (previous) await prisma.orderDocument.updateMany({ where: { orderId, type: "quotation", id: { not: doc.id } }, data: { status: "superseded" } });
    if (send && template.email.sendQuotation) await this.email(doc.id).catch(() => {});
    return this.dto(doc);
  }

  // The receipt for a paid order. Amounts come from the latest quotation when there is one (so the receipt
  // matches what the buyer agreed to), otherwise from the order.
  async issueReceipt({ orderId, send = true }) {
    const existing = await prisma.orderDocument.findFirst({ where: { orderId, type: "receipt" } });
    if (existing) return this.dto(existing);
    const { order, provider, template } = await this._orderContext(orderId);
    const quote = await prisma.orderDocument.findFirst({ where: { orderId, type: "quotation", status: "issued" }, orderBy: { revision: "desc" } });
    const number = await this._nextNumber(provider.id, "receipt", template.receipt.prefix);
    const paidAt = order.transaction?.updatedAt ?? new Date();
    const subtotal = this._lines(order).reduce((s, i) => s + i.total, 0);
    const totals = quote ? quote.snapshot.totals : computeTotals({ subtotal, discount: 0, deliveryFee: 0, tax: template.tax });
    const snapshot = {
      ...this._base({ order, provider, template, type: "receipt" }),
      title: template.receipt.title,
      number,
      revision: 1,
      issuedAt: new Date().toISOString(),
      quotationRef: quote?.number,
      payment: {
        methodLabel: methodLabel(order),
        reference: order.transaction?.metadata?.networkRef || order.transaction?.reference || "",
        paidAt: paidAt.toISOString()
      },
      totals,
      thankYou: template.receipt.thankYou,
      footerNote: template.receipt.footerNote
    };
    try {
      const doc = await this._store({ order, provider, type: "receipt", number, revision: 1, snapshot, total: totals.total });
      if (send && template.email.sendReceipt) await this.email(doc.id).catch(() => {});
      return this.dto(doc);
    } catch (e) {
      if (e?.code === "P2002") return this.dto(await prisma.orderDocument.findFirst({ where: { orderId, type: "receipt" } }));
      throw e;
    }
  }

  // ------------------------------------------------------------------ delivery
  async email(documentId) {
    const doc = await prisma.orderDocument.findUnique({ where: { id: documentId }, include: { order: { include: { user: { select: { email: true } } } }, provider: { include: { user: { select: { email: true } } } } } });
    if (!doc) throw bad("Document not found", "DOCUMENT_NOT_FOUND", 404);
    const to = doc.snapshot.customer?.email || doc.order.user?.email;
    const pdf = await renderDocumentPdf(doc.snapshot);
    const result = await this.emailService.sendDocument({ to, doc, pdf, replyTo: doc.snapshot.brand?.email || doc.provider.user?.email });
    await prisma.orderDocument.update({ where: { id: doc.id }, data: { emailedTo: to ?? null, emailStatus: result.deliveryStatus, ...(result.sent ? { emailedAt: new Date() } : {}) } });
    return result;
  }

  // ------------------------------------------------------------------ reading
  dto(doc) {
    return {
      id: doc.id,
      orderId: doc.orderId,
      type: doc.type,
      number: doc.number,
      revision: doc.revision,
      status: doc.status,
      total: num(doc.total),
      currency: doc.currency,
      issuedAt: doc.issuedAt,
      emailedAt: doc.emailedAt,
      emailedTo: doc.emailedTo,
      emailStatus: doc.emailStatus,
      customerName: doc.snapshot?.customer?.name,
      orderRef: doc.snapshot?.orderRef
    };
  }

  async listForProvider(providerId, { type, page = 1, limit = 30 } = {}) {
    const where = { providerId, ...(type ? { type } : {}) };
    const take = Math.min(100, Math.max(1, Number(limit) || 30));
    const [rows, total] = await Promise.all([
      prisma.orderDocument.findMany({ where, orderBy: { issuedAt: "desc" }, skip: (Math.max(1, Number(page)) - 1) * take, take }),
      prisma.orderDocument.count({ where })
    ]);
    return { items: rows.map((d) => this.dto(d)), total, page: Number(page) || 1 };
  }

  // Every document tied to a list of orders, grouped by order, for the order screens.
  async forOrders(orderIds) {
    if (!orderIds.length) return new Map();
    const rows = await prisma.orderDocument.findMany({ where: { orderId: { in: orderIds } }, orderBy: [{ issuedAt: "desc" }] });
    const map = new Map();
    for (const row of rows) {
      const list = map.get(row.orderId) ?? [];
      list.push(this.dto(row));
      map.set(row.orderId, list);
    }
    return map;
  }

  // Buyers read their own documents, providers theirs.
  async pdfFor({ documentId, actor }) {
    const doc = await prisma.orderDocument.findUnique({ where: { id: documentId }, include: { provider: { select: { userId: true } } } });
    if (!doc) throw bad("Document not found", "DOCUMENT_NOT_FOUND", 404);
    const allowed = doc.userId === actor.id || doc.provider.userId === actor.id || actor.role === "admin";
    if (!allowed) throw bad("Document not found", "DOCUMENT_NOT_FOUND", 404);
    const pdf = await renderDocumentPdf(doc.snapshot);
    return { pdf, filename: `${doc.type === "receipt" ? "Receipt" : "Quotation"}-${doc.number}${doc.revision > 1 ? `-rev${doc.revision}` : ""}.pdf` };
  }

  async resend({ documentId, providerId }) {
    const doc = await prisma.orderDocument.findFirst({ where: { id: documentId, providerId } });
    if (!doc) throw bad("Document not found", "DOCUMENT_NOT_FOUND", 404);
    const result = await this.email(doc.id);
    return { sent: Boolean(result.sent), status: result.deliveryStatus };
  }
}
