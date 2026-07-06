import crypto from "node:crypto";
import { config } from "../config/env.js";

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
