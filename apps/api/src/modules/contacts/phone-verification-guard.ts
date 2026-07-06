import {
  PhoneVerificationAttemptStatus,
  PhoneVerificationLockScope,
  UserContactType,
} from "@maeari/database";
import { config } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import { hashContact } from "../../lib/tokens.js";

const CONTACT_WINDOW_MS = 10 * 60 * 1000;
const CONTACT_MAX_REQUESTS = 3;
const CONTACT_LOCK_MS = 24 * 60 * 60 * 1000;
const IP_WINDOW_MS = 60 * 60 * 1000;
const IP_MAX_DISTINCT_CONTACTS = 5;
const IP_LOCK_MS = 60 * 60 * 1000;
const TWILIO_PROVIDER = "TWILIO";

type PhoneVerificationPreflightInput = {
  userId: string;
  normalizedPhone: string;
  ipAddress: string;
};

type PhoneVerificationPreflightResult = {
  attemptId: string;
  contactHash: string;
};

type TwilioLookupResponse = {
  valid?: boolean;
  country_code?: string;
  line_type_intelligence?: {
    type?: string | null;
    carrier_name?: string | null;
    error_code?: string | null;
  } | null;
};

type LookupDecision = {
  valid: boolean;
  lineType: string;
  carrierName: string | null;
  allowed: boolean;
  reason: string | null;
};

export async function preparePhoneVerificationPreflight(
  input: PhoneVerificationPreflightInput,
): Promise<PhoneVerificationPreflightResult> {
  const contactHash = hashContact(UserContactType.PHONE, input.normalizedPhone);
  const ipHash = hashContact("PHONE_VERIFICATION_IP", normalizeIpAddress(input.ipAddress));
  const now = new Date();

  await assertNotLocked(input.userId, ipHash, contactHash, PhoneVerificationLockScope.IP, ipHash);
  await assertNotLocked(input.userId, ipHash, contactHash, PhoneVerificationLockScope.CONTACT, contactHash);
  await enforceContactRateLimit(input.userId, ipHash, contactHash, now);
  await enforceIpRateLimit(input.userId, ipHash, contactHash, now);

  const attempt = await prisma.phoneVerificationAttempt.create({
    data: {
      userId: input.userId,
      ipHash,
      contactHash,
      status: PhoneVerificationAttemptStatus.REQUESTED,
    },
  });

  try {
    await assertLookupAllowed(contactHash, input.normalizedPhone);
  } catch (error) {
    await markPhoneVerificationAttemptBlocked(
      attempt.id,
      error instanceof AppError ? error.code : "PHONE_LOOKUP_REJECTED",
    );
    throw error;
  }

  return {
    attemptId: attempt.id,
    contactHash,
  };
}

export async function markPhoneVerificationAttemptSent(attemptId?: string | null) {
  if (!attemptId) {
    return;
  }

  await prisma.phoneVerificationAttempt.update({
    where: { id: attemptId },
    data: { status: PhoneVerificationAttemptStatus.SENT, reason: null },
  });
}

export async function markPhoneVerificationAttemptSendFailed(attemptId: string | undefined | null, reason: string) {
  if (!attemptId) {
    return;
  }

  await prisma.phoneVerificationAttempt.update({
    where: { id: attemptId },
    data: {
      status: PhoneVerificationAttemptStatus.SEND_FAILED,
      reason,
    },
  });
}

async function markPhoneVerificationAttemptBlocked(attemptId: string, reason: string) {
  await prisma.phoneVerificationAttempt.update({
    where: { id: attemptId },
    data: {
      status: PhoneVerificationAttemptStatus.BLOCKED,
      reason,
    },
  });
}

async function assertNotLocked(
  userId: string,
  ipHash: string,
  contactHash: string,
  scope: PhoneVerificationLockScope,
  scopeHash: string,
) {
  const lock = await prisma.phoneVerificationLock.findUnique({
    where: {
      scope_scopeHash: {
        scope,
        scopeHash,
      },
    },
  });

  if (!lock || lock.lockedUntil.getTime() <= Date.now()) {
    return;
  }

  const code =
    scope === PhoneVerificationLockScope.IP
      ? "PHONE_VERIFICATION_IP_LOCKED"
      : "PHONE_VERIFICATION_CONTACT_LOCKED";

  await createBlockedAttempt(userId, ipHash, contactHash, lock.reason);

  throw new AppError(code, "단기간에 너무 많은 인증을 요청하셨습니다. 잠시 후 다시 시도해 주세요.", 429, {
    lockedUntil: lock.lockedUntil.toISOString(),
    reason: lock.reason,
  });
}

async function enforceContactRateLimit(userId: string, ipHash: string, contactHash: string, now: Date) {
  const recentCount = await prisma.phoneVerificationAttempt.count({
    where: {
      contactHash,
      status: {
        in: [PhoneVerificationAttemptStatus.REQUESTED, PhoneVerificationAttemptStatus.SENT],
      },
      createdAt: {
        gte: new Date(now.getTime() - CONTACT_WINDOW_MS),
      },
    },
  });

  if (recentCount < CONTACT_MAX_REQUESTS) {
    return;
  }

  const lockedUntil = new Date(now.getTime() + CONTACT_LOCK_MS);
  await upsertLock(PhoneVerificationLockScope.CONTACT, contactHash, "CONTACT_RATE_LIMIT", lockedUntil);
  await createBlockedAttempt(userId, ipHash, contactHash, "CONTACT_RATE_LIMIT");

  throw new AppError(
    "PHONE_VERIFICATION_CONTACT_LOCKED",
    "단기간에 너무 많은 인증을 요청하셨습니다. 잠시 후 다시 시도해 주세요.",
    429,
    { lockedUntil: lockedUntil.toISOString(), reason: "CONTACT_RATE_LIMIT" },
  );
}

async function enforceIpRateLimit(userId: string, ipHash: string, contactHash: string, now: Date) {
  const recentContacts = await prisma.phoneVerificationAttempt.findMany({
    where: {
      ipHash,
      status: {
        in: [PhoneVerificationAttemptStatus.REQUESTED, PhoneVerificationAttemptStatus.SENT],
      },
      createdAt: {
        gte: new Date(now.getTime() - IP_WINDOW_MS),
      },
    },
    select: { contactHash: true },
    distinct: ["contactHash"],
  });
  const knownContactHashes = new Set(recentContacts.map((attempt) => attempt.contactHash));

  if (knownContactHashes.has(contactHash) || knownContactHashes.size < IP_MAX_DISTINCT_CONTACTS) {
    return;
  }

  const lockedUntil = new Date(now.getTime() + IP_LOCK_MS);
  await upsertLock(PhoneVerificationLockScope.IP, ipHash, "IP_DISTINCT_CONTACT_RATE_LIMIT", lockedUntil);
  await createBlockedAttempt(userId, ipHash, contactHash, "IP_DISTINCT_CONTACT_RATE_LIMIT");

  throw new AppError(
    "PHONE_VERIFICATION_IP_LOCKED",
    "단기간에 너무 많은 인증을 요청하셨습니다. 잠시 후 다시 시도해 주세요.",
    429,
    { lockedUntil: lockedUntil.toISOString(), reason: "IP_DISTINCT_CONTACT_RATE_LIMIT" },
  );
}

async function upsertLock(
  scope: PhoneVerificationLockScope,
  scopeHash: string,
  reason: string,
  lockedUntil: Date,
) {
  await prisma.phoneVerificationLock.upsert({
    where: {
      scope_scopeHash: {
        scope,
        scopeHash,
      },
    },
    update: {
      reason,
      lockedUntil,
    },
    create: {
      scope,
      scopeHash,
      reason,
      lockedUntil,
    },
  });
}

async function createBlockedAttempt(userId: string, ipHash: string, contactHash: string, reason: string) {
  await prisma.phoneVerificationAttempt.create({
    data: {
      userId,
      ipHash,
      contactHash,
      status: PhoneVerificationAttemptStatus.BLOCKED,
      reason,
    },
  });
}

async function assertLookupAllowed(contactHash: string, normalizedPhone: string) {
  if (!config.phoneLookupEnabled) {
    return;
  }

  const cached = await prisma.phoneNumberLookupCache.findUnique({
    where: {
      provider_contactHash: {
        provider: TWILIO_PROVIDER,
        contactHash,
      },
    },
  });

  if (cached && cached.expiresAt.getTime() > Date.now()) {
    if (cached.allowed) {
      return;
    }

    throw new AppError("CONTACT_PHONE_INVALID", "휴대전화 번호만 인증할 수 있어요.", 400, {
      reason: cached.reason,
      lineType: cached.lineType,
    });
  }

  const decision = await lookupTwilioLineType(normalizedPhone);
  await prisma.phoneNumberLookupCache.upsert({
    where: {
      provider_contactHash: {
        provider: TWILIO_PROVIDER,
        contactHash,
      },
    },
    update: {
      valid: decision.valid,
      lineType: decision.lineType,
      carrierName: decision.carrierName,
      allowed: decision.allowed,
      reason: decision.reason,
      checkedAt: new Date(),
      expiresAt: lookupCacheExpiresAt(),
    },
    create: {
      provider: TWILIO_PROVIDER,
      contactHash,
      valid: decision.valid,
      lineType: decision.lineType,
      carrierName: decision.carrierName,
      allowed: decision.allowed,
      reason: decision.reason,
      expiresAt: lookupCacheExpiresAt(),
    },
  });

  if (!decision.allowed) {
    throw new AppError("CONTACT_PHONE_INVALID", "휴대전화 번호만 인증할 수 있어요.", 400, {
      reason: decision.reason,
      lineType: decision.lineType,
    });
  }
}

async function lookupTwilioLineType(normalizedPhone: string): Promise<LookupDecision> {
  const accountSid = config.twilioAccountSid;
  const authToken = config.twilioAuthToken;

  if (!accountSid || !authToken) {
    throw new AppError("PHONE_LOOKUP_UNAVAILABLE", "번호 확인 서비스가 잠시 불안정해요. 잠시 후 다시 시도해 주세요.", 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.phoneLookupTimeoutMs);
  const e164Phone = `+82${normalizedPhone.slice(1)}`;
  const url = new URL(`https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164Phone)}`);
  url.searchParams.set("Fields", "line_type_intelligence");

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AppError(
        "PHONE_LOOKUP_UNAVAILABLE",
        "번호 확인 서비스가 잠시 불안정해요. 잠시 후 다시 시도해 주세요.",
        503,
      );
    }

    const data = (await response.json()) as TwilioLookupResponse;
    const lineType = data.line_type_intelligence?.type ?? "unknown";
    const errorCode = data.line_type_intelligence?.error_code;
    const valid = data.valid === true;
    const allowed = valid && data.country_code === "KR" && lineType === "mobile" && !errorCode;

    return {
      valid,
      lineType,
      carrierName: data.line_type_intelligence?.carrier_name ?? null,
      allowed,
      reason: allowed
        ? null
        : errorCode
          ? `TWILIO_${errorCode}`
          : invalidLookupReason(data, lineType),
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      "PHONE_LOOKUP_UNAVAILABLE",
      "번호 확인 서비스가 잠시 불안정해요. 잠시 후 다시 시도해 주세요.",
      503,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function invalidLookupReason(data: TwilioLookupResponse, lineType: string) {
  if (data.valid !== true) {
    return "PHONE_LOOKUP_INVALID";
  }

  if (data.country_code !== "KR") {
    return "PHONE_LOOKUP_COUNTRY_NOT_ALLOWED";
  }

  return `PHONE_LOOKUP_LINE_TYPE_${lineType.toUpperCase()}`;
}

function lookupCacheExpiresAt() {
  return new Date(Date.now() + config.phoneLookupCacheTtlDays * 24 * 60 * 60 * 1000);
}

function normalizeIpAddress(ipAddress: string) {
  return ipAddress.trim().toLowerCase() || "unknown";
}
