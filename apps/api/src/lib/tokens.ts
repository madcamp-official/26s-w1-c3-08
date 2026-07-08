import crypto from "node:crypto";
import { config } from "../config/env.js";

const PUBLIC_TOKEN_CIPHER_VERSION = "v1";
const PUBLIC_TOKEN_CIPHER_ALGORITHM = "aes-256-gcm";
const PUBLIC_TOKEN_CIPHER_AAD = Buffer.from("maeari:public-token:v1", "utf8");

export function createPublicToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashPublicToken(token: string) {
  return crypto
    .createHmac("sha256", config.publicTokenPepper)
    .update(token)
    .digest("hex");
}

export function hashContact(channel: string, normalizedContact: string) {
  return crypto
    .createHmac("sha256", config.publicTokenPepper)
    .update(`${channel}:${normalizedContact}`)
    .digest("hex");
}

export function hashOtpCode(scope: string, code: string) {
  return crypto
    .createHmac("sha256", config.publicTokenPepper)
    .update(`otp:${scope}:${code}`)
    .digest("hex");
}

export function createTokenPreview(token: string) {
  return token.slice(0, 8);
}

export function hashText(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function encryptPublicToken(token: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(PUBLIC_TOKEN_CIPHER_ALGORITHM, getPublicTokenEncryptionKey(), iv);
  cipher.setAAD(PUBLIC_TOKEN_CIPHER_AAD);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PUBLIC_TOKEN_CIPHER_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptPublicToken(encryptedToken: string) {
  const [version, iv, tag, encrypted] = encryptedToken.split(":");

  if (version !== PUBLIC_TOKEN_CIPHER_VERSION || !iv || !tag || !encrypted) {
    throw new Error("Invalid encrypted public token format");
  }

  const decipher = crypto.createDecipheriv(
    PUBLIC_TOKEN_CIPHER_ALGORITHM,
    getPublicTokenEncryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(PUBLIC_TOKEN_CIPHER_AAD);
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function getPublicTokenEncryptionKey() {
  return crypto
    .createHash("sha256")
    .update(`maeari-public-token:${config.publicTokenEncryptionKey}`)
    .digest();
}
