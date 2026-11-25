import { prisma } from "../config/db.js";
import { env } from "../config/env.js";

// Lazily imported - firebase-admin reaches out to Google's metadata/token endpoints on init, so
// it's only worth loading at all when a service account is actually configured (keeps a bare
// `npm install` + no Firebase project set up from ever touching the network).
let adminApp = null;
let adminModule = null;
const initAdmin = async () => {
  if (adminApp) return adminApp;
  if (!env.firebaseServiceAccountJson) return null;
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(env.firebaseServiceAccountJson);
  } catch {
    process.stderr.write("[push] FIREBASE_SERVICE_ACCOUNT_JSON is set but isn't valid JSON - push notifications are disabled\n");
    return null;
  }
  adminModule = await import("firebase-admin");
  adminApp = adminModule.default.initializeApp({ credential: adminModule.default.credential.cert(serviceAccount) });
  return adminApp;
};

// Sends FCM push notifications and owns the device-token table they're addressed from. Every
// public method is best-effort: a push failure (no Firebase project configured yet, a bad
// token, FCM being briefly down) must never break the business action it's attached to - callers
// fire-and-forget this the same way OrderNotificationService's emails are fire-and-forget.
export class PushService {
  async isConfigured() {
    return Boolean(await initAdmin());
  }

  async registerToken({ userId, token, platform }) {
    if (!userId || !token) return;
    await prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform: platform || "unknown" },
      update: { userId, platform: platform || "unknown" }
    });
  }

  async unregisterToken({ token }) {
    if (!token) return;
    await prisma.deviceToken.deleteMany({ where: { token } });
  }

  // title/body/data all optional in combination, but at least a title or body is expected -
  // `data` is a flat string->string map (FCM's own requirement) carried for client-side routing
  // (e.g. { type: "ride_offer", tripId }).
  async sendToUser({ userId, title, body, data = {} }) {
    if (!userId) return { sent: 0 };
    try {
      const app = await initAdmin();
      if (!app) return { sent: 0, reason: "not_configured" };

      const tokens = await prisma.deviceToken.findMany({ where: { userId }, select: { token: true } });
      if (!tokens.length) return { sent: 0, reason: "no_tokens" };

      const stringData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));
      const response = await adminModule.default.messaging(app).sendEachForMulticast({
        tokens: tokens.map((t) => t.token),
        notification: { title, body },
        data: stringData
      });

      // A token FCM reports as unregistered/invalid will never succeed again - prune it instead
      // of paying its failure cost on every future push to this user.
      const dead = [];
      response.responses.forEach((r, i) => {
        const code = r.error?.code;
        if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
          dead.push(tokens[i].token);
        }
      });
      if (dead.length) await prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });

      return { sent: response.successCount };
    } catch (e) {
      process.stderr.write(`[push] sendToUser failed: ${e?.message ?? e}\n`);
      return { sent: 0, reason: "error" };
    }
  }
}
