import path from "node:path";
import { existsSync } from "node:fs";
import dotenv from "dotenv";

const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";

dotenv.config({ path: resolveEnvPath(envFile) });

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
  publicTokenPepper: requireEnv("PUBLIC_TOKEN_PEPPER"),
  deliveryCron: requireEnv("DELIVERY_CRON"),
  moderationRetryCron: requireEnv("MODERATION_RETRY_CRON"),
  moderationMaxAttempts: requireNumberEnv("MODERATION_MAX_ATTEMPTS"),
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

function optionalEnv(key: string): string | undefined {
  const value = process.env[key];
  return value ? value : undefined;
}

function requireNumberEnv(key: string): number {
  const value = Number(requireEnv(key));

  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable must be a number: ${key}`);
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
