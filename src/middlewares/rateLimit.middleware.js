import rateLimit from "express-rate-limit";

export const defaultRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  // Same { error } shape as every other failure, so the apps can show the message.
  message: { error: { code: "RATE_LIMITED", message: "Too many requests. Please wait a moment and try again." } }
});
