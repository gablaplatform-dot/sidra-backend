// Renders every email template with sample data into ./email-previews/*.html (nothing is sent).
// Usage: node scripts/preview-emails.mjs   then open the files in a browser.
import fs from "node:fs";
import path from "node:path";
import * as T from "../src/emails/templates.js";

const out = path.resolve(process.argv[2] || "email-previews");
fs.mkdirSync(out, { recursive: true });

const order = {
  id: "cmv84mlxr000frqb5j3klcf2u",
  total: 1450000,
  transactionId: null,
  metadata: { paymentMethod: "cash" },
  customer: { name: "Amy Nakato", phone: "0772 000 111", email: "amy@example.com", notes: "Please call before you arrive." },
  fulfillment: { method: "delivery", address: "Plot 12, Bukoto Street, Kampala", lat: 0.3476, lng: 32.5825 },
  provider: { businessName: "Gadget Galaxy Ug" },
  items: [
    { name: "Samsung Galaxy A54 5G 128GB", quantity: 1, total: 1200000 },
    { name: "Tempered glass protector", quantity: 2, total: 50000 },
    { name: "Fast charger 25W", quantity: 1, total: 200000 }
  ]
};
const onlineOrder = { ...order, metadata: { paymentMethod: "online" } };
const trip = { departureAt: new Date(Date.now() + 36 * 3600 * 1000) };
const route = { originName: "Kampala", destinationName: "Gulu", boardingPoint: "Old Taxi Park, Gate 3" };
const operator = { companyName: "Post Bus Uganda", parkName: "Old Taxi Park" };
const tickets = [
  { ticketNumber: "GB7K29QX", passengerName: "Amy Nakato", ticketTypeName: "Standard", seatNumber: 14 },
  { ticketNumber: "GB7K29QY", passengerName: "Brian Okello", ticketTypeName: "Standard", seatNumber: 15 }
];
const booking = { passengerName: "Amy Nakato", reference: "BT4M8H2", total: 90000 };
const bctx = { listingName: "Lakeview Deluxe Room", when: "12 Nov 2026 to 14 Nov 2026", size: "2 nights", total: 640000, reference: "BKX7M2P9", status: "pending", paymentStatus: "awaiting_approval", guest: { name: "Amy Nakato", phone: "0772 000 111", notes: "Arriving late evening." }, hoursToAnswer: 12, hoursToPay: 24, amountDue: 320000, amountPaid: 320000, policy: "Free cancellation up to 24 hours before the start.", providerNote: "Check-in from 2pm.", address: "Plot 4, Lake Road, Entebbe", phone: "0772 123 456", depositNote: "A 50% deposit secures the booking." };
const doc = (type) => ({ type, number: type === "receipt" ? "RC-2026-0042" : "QT-2026-0042", total: 1450000, provider: { businessName: "Gadget Galaxy Ug" }, snapshot: { customer: { name: "Amy Nakato" }, brand: { businessName: "Gadget Galaxy Ug", phone: "0772 123 456" }, issuedAt: new Date(), validUntil: new Date(Date.now() + 7 * 86400000), payment: { paidAt: new Date() }, items: order.items } });

const emails = {
  "provider-invite": T.providerInvite({ businessName: "Pearl Mobile", link: "https://gabla.example/provider/onboarding?token=abc" }),
  "provider-relink": T.providerRelink({ businessName: "Pearl Mobile", link: "https://gabla.example/provider/onboarding?token=abc" }),
  "admin-invite": T.adminInvite({ name: "Grace Akello", roleName: "Support Manager", link: "https://gabla.example/accept-invite?token=abc" }),
  "bus-operator-invite": T.busOperatorInvite({ companyName: "Post Bus Uganda", link: "https://gabla.example/bus/onboarding?token=abc" }),
  "order-new-seller": T.orderNewForSeller({ order }),
  "order-approved-buyer": T.orderApprovedForBuyer({ order: onlineOrder }),
  "order-paid-seller": T.orderPaidForSeller({ order: { ...onlineOrder, transactionId: "tx1" } }),
  "order-accepted-buyer": T.orderStatusForBuyer({ order, status: "accepted" }),
  "order-delivering-buyer": T.orderStatusForBuyer({ order, status: "delivering" }),
  "order-delivered-buyer": T.orderStatusForBuyer({ order, status: "fulfilled" }),
  "order-cancelled-buyer": T.orderStatusForBuyer({ order, status: "canceled" }),
  "booking-request-provider": T.bookingEmail({ event: "created", to: "provider", ctx: bctx }),
  "booking-request-customer": T.bookingEmail({ event: "created", to: "customer", ctx: bctx }),
  "booking-confirmed-customer": T.bookingEmail({ event: "confirmed", to: "customer", ctx: { ...bctx, paymentStatus: "payable" } }),
  "booking-paid-customer": T.bookingEmail({ event: "paid", to: "customer", ctx: bctx }),
  "booking-declined-customer": T.bookingEmail({ event: "declined", to: "customer", ctx: bctx }),
  "bus-ticket": T.busTicket({ booking, trip, route, operator, tickets }),
  "bus-announcement": T.busAnnouncement({ operator, title: "Your Gulu trip leaves 45 minutes late", message: "Because of road works near Karuma the bus will leave at 08:45 instead of 08:00.\nSorry for the inconvenience.", kind: "delay", trip, route }),
  "quotation": T.documentEmail({ doc: doc("quotation"), business: "Gadget Galaxy Ug", accent: "#0B2046", ordersUrl: "https://gabla.example/orders" }),
  "receipt": T.documentEmail({ doc: doc("receipt"), business: "Gadget Galaxy Ug", accent: "#0F766E", ordersUrl: "https://gabla.example/orders" })
};

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
