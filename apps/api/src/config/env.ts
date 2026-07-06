import path from "node:path";
import { existsSync } from "node:fs";
import dotenv from "dotenv";

const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";

dotenv.config({ path: resolveEnvPath(".env") });
dotenv.config({ path: resolveEnvPath(envFile), override: true });

const mcpNotificationEnabled = optionalBooleanEnv("MCP_NOTIFICATION_ENABLED", false);
const gmailSmtpEnabled =
  optionalBooleanEnvFrom(["GMAIL_SMTP_ENABLED", "SMTP_ENABLED"]) ??
  Boolean(optionalEnvFrom(["GMAIL_SMTP_USER", "SMTP_EMAIL"]) && optionalEnvFrom(["GMAIL_SMTP_APP_PASSWORD", "SMTP_PASSWORD"]));
const gmailSmtpUser = gmailSmtpEnabled
  ? requireEnvFrom(["GMAIL_SMTP_USER", "SMTP_EMAIL"])
  : optionalEnvFrom(["GMAIL_SMTP_USER", "SMTP_EMAIL"]);
const gmailSmtpAppPassword = gmailSmtpEnabled
  ? requireEnvFrom(["GMAIL_SMTP_APP_PASSWORD", "SMTP_PASSWORD"])
  : optionalEnvFrom(["GMAIL_SMTP_APP_PASSWORD", "SMTP_PASSWORD"]);
const solapiSmsEnabled =
  optionalBooleanEnvFrom(["SOLAPI_SMS_ENABLED"]) ??
  Boolean(optionalEnv("SOLAPI_API_KEY") && optionalEnv("SOLAPI_API_SECRET") && optionalEnv("SOLAPI_SENDER_NUMBER"));
const solapiApiKey = solapiSmsEnabled ? requireEnv("SOLAPI_API_KEY") : optionalEnv("SOLAPI_API_KEY");
const solapiApiSecret = solapiSmsEnabled ? requireEnv("SOLAPI_API_SECRET") : optionalEnv("SOLAPI_API_SECRET");
const solapiSenderNumber = solapiSmsEnabled
  ? requirePhoneNumberEnv("SOLAPI_SENDER_NUMBER")
  : optionalPhoneNumberEnv("SOLAPI_SENDER_NUMBER");

export const config = {
  nodeEnv: requireEnv("NODE_ENV"),
  apiPort: requireNumberEnv("API_PORT"),
  webPort: requireNumberEnv("WEB_PORT"),
  serviceDomain: requireEnv("SERVICE_DOMAIN"),
  wwwServiceDomain: requireEnv("WWW_SERVICE_DOMAIN"),
  webOrigin: requireEnv("WEB_ORIGIN"),
  serviceUrl: requireEnv("SERVICE_URL"),
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtSecret: requireEnv("JWT_SECRET"),
  cookieDomain: optionalEnv("COOKIE_DOMAIN"),
  cookieSecure: requireBooleanEnv("COOKIE_SECURE"),
  kakaoClientId: requireEnv("KAKAO_CLIENT_ID"),
  kakaoClientSecret: requireEnv("KAKAO_CLIENT_SECRET"),
  kakaoRedirectUri: requireEnv("KAKAO_REDIRECT_URI"),
  openaiApiKey: requireEnv("OPENAI_API_KEY"),
  openaiModerationModel: requireEnv("OPENAI_MODERATION_MODEL"),
  openaiGuardrailModel: optionalEnv("OPENAI_GUARDRAIL_MODEL") ?? "gpt-5.4-mini",
  publicTokenPepper: requireEnv("PUBLIC_TOKEN_PEPPER"),
  uploadDir: optionalEnv("UPLOAD_DIR") ?? path.resolve(process.cwd(), "uploads"),
  uploadPublicPath: optionalEnv("UPLOAD_PUBLIC_PATH") ?? "/api/uploads",
  maxAttachmentCount: optionalNumberEnv("MAX_ATTACHMENT_COUNT", 3),
  maxAttachmentBytes: optionalNumberEnv("MAX_ATTACHMENT_BYTES", 2 * 1024 * 1024),
  adminKakaoIds: parseCsvEnv("ADMIN_KAKAO_IDS"),
  deliveryCron: requireEnv("DELIVERY_CRON"),
  moderationRetryCron: requireEnv("MODERATION_RETRY_CRON"),
  moderationMaxAttempts: requireNumberEnv("MODERATION_MAX_ATTEMPTS"),
  notificationRetryCron: optionalEnv("NOTIFICATION_RETRY_CRON") ?? "*/5 * * * *",
  notificationMaxAttempts: optionalNumberEnv("NOTIFICATION_MAX_ATTEMPTS", 3),
  gmailSmtpEnabled,
  gmailSmtpHost: optionalEnvFrom(["GMAIL_SMTP_HOST", "SMTP_HOST"]) ?? "smtp.gmail.com",
  gmailSmtpPort: optionalNumberEnvFrom(["GMAIL_SMTP_PORT", "SMTP_PORT"], 465),
  gmailSmtpSecure: optionalBooleanEnvFrom(["GMAIL_SMTP_SECURE", "SMTP_SECURE"]) ?? true,
  gmailSmtpUser,
  gmailSmtpAppPassword,
  gmailSmtpFromName: optionalEnvFrom(["GMAIL_SMTP_FROM_NAME", "SMTP_FROM_NAME"]) ?? "매아리",
  gmailSmtpFromAddress: optionalEnvFrom(["GMAIL_SMTP_FROM_ADDRESS", "SMTP_FROM_ADDRESS"]) ?? gmailSmtpUser,
  gmailSmtpConnectionTimeoutMs: optionalNumberEnv("GMAIL_SMTP_CONNECTION_TIMEOUT_MS", 10000),
  solapiSmsEnabled,
  solapiApiKey,
  solapiApiSecret,
  solapiSenderNumber,
  mcpNotificationEnabled,
  mcpNotificationServer: mcpNotificationEnabled ? requireEnv("MCP_NOTIFICATION_SERVER") : optionalEnv("MCP_NOTIFICATION_SERVER"),
  mcpEmailTool: mcpNotificationEnabled ? requireEnv("MCP_EMAIL_TOOL") : optionalEnv("MCP_EMAIL_TOOL"),
  mcpSmsTool: mcpNotificationEnabled ? requireEnv("MCP_SMS_TOOL") : optionalEnv("MCP_SMS_TOOL"),
  mcpNotificationApiKey: mcpNotificationEnabled
    ? requireEnv("MCP_NOTIFICATION_API_KEY")
    : optionalEnv("MCP_NOTIFICATION_API_KEY"),
  mcpNotificationAuthHeader: optionalEnv("MCP_NOTIFICATION_AUTH_HEADER") ?? "Authorization",
  mcpNotificationAuthScheme: optionalEnv("MCP_NOTIFICATION_AUTH_SCHEME") ?? "Bearer",
  mcpNotificationTimeoutMs: optionalNumberEnv("MCP_NOTIFICATION_TIMEOUT_MS", 10000),
};

function resolveEnvPath(fileName: string) {
  const candidates = [
    path.resolve(process.cwd(), fileName),
    path.resolve(process.cwd(), "../../", fileName),
    path.resolve(process.cwd(), "../../../", fileName),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? path.resolve(process.cwd(), fileName);
}

function requireEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function requireEnvFrom(keys: string[]): string {
  const value = optionalEnvFrom(keys);

  if (!value) {
    throw new Error(`Missing required environment variable: ${keys.join(" or ")}`);
  }

  return value;
}

function requirePhoneNumberEnv(key: string): string {
  const value = requireEnv(key);

  if (!isDomesticPhoneNumber(value)) {
    throw new Error(`Environment variable must be a domestic phone number without separators: ${key}`);
  }

  return value;
}

function optionalEnv(key: string): string | undefined {
  const value = process.env[key];
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function optionalPhoneNumberEnv(key: string) {
  const value = optionalEnv(key);

  if (!value) {
    return undefined;
  }

  if (!isDomesticPhoneNumber(value)) {
    throw new Error(`Environment variable must be a domestic phone number without separators: ${key}`);
  }

  return value;
}

function optionalEnvFrom(keys: string[]) {
  for (const key of keys) {
    const value = optionalEnv(key);

    if (value) {
      return value;
    }
  }

  return undefined;
}

function requireNumberEnv(key: string): number {
  const value = Number(requireEnv(key));

  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable must be a number: ${key}`);
  }

  return value;
}

function optionalNumberEnv(key: string, fallback: number): number {
  const raw = optionalEnv(key);

  if (!raw) {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable must be a number: ${key}`);
  }

  return value;
}

function optionalNumberEnvFrom(keys: string[], fallback: number): number {
  const raw = optionalEnvFrom(keys);

  if (!raw) {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable must be a number: ${keys.join(" or ")}`);
  }

  return value;
}

function requireBooleanEnv(key: string): boolean {
  const value = requireEnv(key);

  if (value !== "true" && value !== "false") {
    throw new Error(`Environment variable must be "true" or "false": ${key}`);
  }

  return value === "true";
}

function optionalBooleanEnvFrom(keys: string[]): boolean | undefined {
  const value = optionalEnvFrom(keys);

  if (!value) {
    return undefined;
  }

  if (value !== "true" && value !== "false") {
    throw new Error(`Environment variable must be "true" or "false": ${keys.join(" or ")}`);
  }

  return value === "true";
}

function optionalBooleanEnv(key: string, fallback: boolean): boolean {
  const value = optionalEnv(key);

  if (!value) {
    return fallback;
  }

  if (value !== "true" && value !== "false") {
    throw new Error(`Environment variable must be "true" or "false": ${key}`);
  }

  return value === "true";
}

function parseCsvEnv(key: string) {
  return (optionalEnv(key) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isDomesticPhoneNumber(value: string) {
  return /^0\d{9,10}$/.test(value);
}
