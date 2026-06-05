import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";

const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"]);

const extensionForContentType = (contentType) => {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  if (contentType === "video/mp4") return "mp4";
  return "bin";
};

const safeSegment = (value) =>
  String(value ?? "asset")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "asset";

export class StorageService {
  constructor() {
    this.client = null;
  }

  getClient() {
    if (!env.r2Endpoint || !env.r2AccessKeyId || !env.r2SecretAccessKey || !env.r2Bucket) {
      throw new AppError({ message: "R2 storage is not configured", statusCode: 503, code: "STORAGE_NOT_CONFIGURED" });
    }

    if (!this.client) {
      this.client = new S3Client({
        region: "auto",
        endpoint: env.r2Endpoint,
        credentials: {
          accessKeyId: env.r2AccessKeyId,
          secretAccessKey: env.r2SecretAccessKey
        }
      });
    }

    return this.client;
  }

  async createUploadUrl({ actorUserId, role, contentType, folder = "provider-media", filename }) {
    if (!allowedContentTypes.has(contentType)) {
      throw new AppError({ message: "Unsupported content type", statusCode: 400, code: "UNSUPPORTED_CONTENT_TYPE" });
    }

    const ext = extensionForContentType(contentType);
    const baseName = safeSegment(filename ? filename.replace(/\.[^.]+$/, "") : "asset");
    const key = [
      safeSegment(folder),
      safeSegment(role),
      safeSegment(actorUserId),
      `${Date.now()}-${baseName}.${ext}`
    ].join("/");

    const command = new PutObjectCommand({
      Bucket: env.r2Bucket,
      Key: key,
      ContentType: contentType
    });

    const uploadUrl = await getSignedUrl(this.getClient(), command, { expiresIn: 60 * 5 });
    const publicUrl = env.r2PublicBaseUrl ? `${env.r2PublicBaseUrl.replace(/\/$/, "")}/${key}` : null;

    return {
      key,
      uploadUrl,
      publicUrl,
      method: "PUT",
      headers: { "Content-Type": contentType },
      expiresInSeconds: 300
    };
  }

  async registerAsset({ actorUserId, role, key, url, providerId, mimeType, size, kind = "image", metadata }) {
    if (!key || !url) {
      throw new AppError({ message: "key and url are required", statusCode: 400, code: "ASSET_REQUIRED" });
    }
    if (providerId) {
      const provider = await prisma.provider.findUnique({ where: { id: providerId } });
      if (!provider) throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
      if (role === "provider" && provider.userId !== actorUserId) {
        throw new AppError({ message: "Forbidden", statusCode: 403, code: "FORBIDDEN" });
      }
    }

    const asset = await prisma.mediaAsset.create({
      data: {
        providerId: providerId ?? null,
        ownerId: actorUserId,
        key,
        url,
        mimeType: mimeType ?? null,
        size: size ?? null,
        kind,
        metadata: metadata ?? {}
      }
    });

    return asset;
  }
}
