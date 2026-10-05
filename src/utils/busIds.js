import crypto from "crypto";

// No 0/O/1/I/L: tickets get read out loud and typed in at a bus park, so look-alikes are out.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

const randomChars = (n) => {
  const bytes = crypto.randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
};

export const makeTicketNumber = () => `GBT-${randomChars(4)}-${randomChars(4)}`;
export const makeBookingReference = () => `GB${randomChars(6)}`;

export const slugify = (text) =>
  String(text ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) || "bus";
