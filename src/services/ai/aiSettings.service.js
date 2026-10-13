import crypto from "node:crypto";

import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";

const ID = "singleton";
const DEFAULT_MODEL = "claude-haiku-5-5";

// The key is encrypted at rest with a key derived from JWT_SECRET, so a copy of the database alone
// doesn't expose it. (Rotating JWT_SECRET means the saved key must be entered again.)
const cryptoKey = () => crypto.createHash("sha256").update(`ai-settings:${env.jwtSecret}`).digest();

const encrypt = (plain) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", cryptoKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
};

const decrypt = (packed) => {
  try {
    const [iv, tag, body] = String(packed).split(".").map((p) => Buffer.from(p, "base64"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", cryptoKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
};

const mask = (key) => (key ? `${key.slice(0, 7)}…${key.slice(-4)}` : null);

export class AiSettingsService {
  async _row() {
    return (
      (await prisma.aiSettings.findUnique({ where: { id: ID } })) ??
      prisma.aiSettings.create({ data: { id: ID, model: DEFAULT_MODEL } })
    );
  }

  // What the search code needs at call time: is AI on, and with which key/model.
  async runtime() {
    const row = await this._row();
    const savedKey = row.apiKeyEnc ? decrypt(row.apiKeyEnc) : "";
    const apiKey = savedKey || env.anthropicApiKey;
    return { enabled: Boolean(row.enabled && apiKey), apiKey, model: row.model || DEFAULT_MODEL };
  }

  async get() {
    const row = await this._row();
    const savedKey = row.apiKeyEnc ? decrypt(row.apiKeyEnc) : "";
    const activeKey = savedKey || env.anthropicApiKey;
    return {
      enabled: Boolean(row.enabled),
      model: row.model || DEFAULT_MODEL,
      keySource: savedKey ? "admin" : env.anthropicApiKey ? "environment" : "none",
      keyPreview: mask(activeKey),
      working: Boolean(row.enabled && activeKey),
      requestCount: row.requestCount,
      errorCount: row.errorCount,
      lastError: row.lastError,
      lastUsedAt: row.lastUsedAt,
      lastErrorAt: row.lastErrorAt
    };
  }

  async update({ enabled, apiKey, model, clearKey }) {
    await this._row();
    const data = {};
    if (enabled !== undefined) data.enabled = Boolean(enabled);
    if (model !== undefined) data.model = String(model).trim() || DEFAULT_MODEL;
    if (clearKey) data.apiKeyEnc = null;
    if (apiKey !== undefined && String(apiKey).trim()) {
      const key = String(apiKey).trim();
      if (!/^sk-ant-/.test(key)) {
        throw new AppError({ message: "That doesn't look like an Anthropic API key (it should start with sk-ant-).", statusCode: 400, code: "INVALID_AI_KEY" });
      }
      data.apiKeyEnc = encrypt(key);
    }
    if (Object.keys(data).length) {
      await prisma.aiSettings.update({ where: { id: ID }, data });
      this.onChange?.();
    }
    return this.get();
  }

  // Fire-and-forget bookkeeping; never allowed to break a search.
  recordSuccess() {
    prisma.aiSettings
      .update({ where: { id: ID }, data: { requestCount: { increment: 1 }, lastUsedAt: new Date() } })
      .catch(() => {});
  }

  recordFailure(message) {
    prisma.aiSettings
      .update({
        where: { id: ID },
        data: { requestCount: { increment: 1 }, errorCount: { increment: 1 }, lastError: String(message).slice(0, 300), lastErrorAt: new Date() }
      })
      .catch(() => {});
  }
}
