import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtIssuer: process.env.JWT_ISSUER ?? "sidra",
  jwtAccessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 60 * 60),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  allowProviderSelfRegister: String(process.env.ALLOW_PROVIDER_SELF_REGISTER ?? "").toLowerCase() === "true",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:5173",
  providerOnboardingBaseUrl: process.env.PROVIDER_ONBOARDING_BASE_URL ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "",
  r2Endpoint: process.env.R2_ENDPOINT ?? "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  r2Bucket: process.env.R2_BUCKET ?? "",
  r2PublicBaseUrl: process.env.R2_PUBLIC_BASE_URL ?? "",
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? "",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? "",
  seedAdminName: process.env.SEED_ADMIN_NAME ?? "Admin",
  seedAdminPhone: process.env.SEED_ADMIN_PHONE ?? ""
};

export const assertRequiredEnv = () => {
  const missing = [];
  if (!env.databaseUrl) missing.push("DATABASE_URL");
  if (!env.jwtSecret) missing.push("JWT_SECRET");

  if (missing.length) {
    throw new Error(`Missing required env: ${missing.join(", ")}`);
  }
};
