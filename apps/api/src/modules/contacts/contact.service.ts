import crypto from "node:crypto";
import {
  UserContactType,
  UserContactVerificationStatus,
  type UserContact,
} from "@maeari/database";
import { AppError } from "../../lib/app-error.js";
import {
  normalizeEmailContact,
  normalizeOptionalEmailContact,
  normalizeStrictKoreanMobilePhone,
  isStrictKoreanMobilePhone,
} from "../../lib/contact-normalization.js";
import { prisma } from "../../lib/prisma.js";
import { hashContact, hashOtpCode } from "../../lib/tokens.js";
import { externalNotificationProvider } from "../../processors/notification-provider.js";
import type {
  CreateUserContactInput,
  UpdateUserContactInput,
  VerifyUserContactInput,
} from "./contact.validation.js";
import {
  markPhoneVerificationAttemptSendFailed,
  markPhoneVerificationAttemptSent,
  preparePhoneVerificationPreflight,
} from "./phone-verification-guard.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

type RequestContext = {
  ipAddress: string;
};

export async function listUserContacts(userId: string) {
  await ensureKakaoEmailContact(userId);
  const contacts = await prisma.userContact.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  const sortedContacts = [...contacts].sort(compareContactsForDisplay);

  return {
    contacts: sortedContacts.map(mapContact),
    writerEligibility: {
      hasVerifiedStrictPhone: contacts.some(isWriteEligiblePhoneContact),
    },
  };
}

function compareContactsForDisplay(left: UserContact, right: UserContact) {
  if (left.type !== right.type) {
    return left.type === UserContactType.PHONE ? -1 : 1;
  }

  if (left.isPrimary !== right.isPrimary) {
    return left.isPrimary ? -1 : 1;
  }

  const leftVerifiedAt = left.verifiedAt?.getTime() ?? 0;
  const rightVerifiedAt = right.verifiedAt?.getTime() ?? 0;

  if (leftVerifiedAt !== rightVerifiedAt) {
    return rightVerifiedAt - leftVerifiedAt;
  }

  return right.createdAt.getTime() - left.createdAt.getTime();
}

export async function createUserContact(userId: string, input: CreateUserContactInput, context?: RequestContext) {
  const normalized = normalizeContactInput(input.type, input.value);
  const type = input.type === "PHONE" ? UserContactType.PHONE : UserContactType.EMAIL;
  const contactHash = hashContact(type, normalized);
  const existing = await prisma.userContact.findUnique({
    where: {
      type_contactHash: {
        type,
        contactHash,
      },
    },
  });

  if (existing && existing.userId !== userId) {
    throw new AppError("CONTACT_ALREADY_REGISTERED", "이미 다른 계정에 등록된 연락처예요.", 409);
  }

  const hasPrimary = await prisma.userContact.findFirst({
    where: {
      userId,
      deletedAt: null,
      isPrimary: true,
    },
    select: { id: true },
  });
  const label = normalizeLabel(input.label);
  const contact = existing
    ? await prisma.userContact.update({
        where: { id: existing.id },
        data: {
          value: normalized,
          label,
          deletedAt: null,
          ...(type === UserContactType.PHONE && existing.deletedAt
            ? { verifiedAt: null, verificationSource: null, isPrimary: false }
            : { isPrimary: existing.isPrimary || !hasPrimary }),
        },
      })
    : await prisma.userContact.create({
        data: {
          userId,
          type,
          value: normalized,
          contactHash,
          label,
          isPrimary: !hasPrimary,
        },
      });

  if (contact.verifiedAt) {
    return {
      contact: mapContact(contact),
      verificationSent: false,
    };
  }

  await createAndSendVerification(contact, context);

  return {
    contact: mapContact(contact),
    verificationSent: true,
  };
}

export async function sendUserContactVerificationCode(userId: string, contactId: string, context?: RequestContext) {
  const contact = await findOwnedContact(userId, contactId);

  if (contact.verifiedAt) {
    return {
      contact: mapContact(contact),
      verificationSent: false,
    };
  }

  await createAndSendVerification(contact, context);

  return {
    contact: mapContact(contact),
    verificationSent: true,
  };
}

export async function verifyUserContact(userId: string, contactId: string, input: VerifyUserContactInput) {
  const contact = await findOwnedContact(userId, contactId);
  const verification = await prisma.userContactVerification.findFirst({
    where: {
      userContactId: contact.id,
      status: UserContactVerificationStatus.PENDING,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!verification) {
    throw new AppError("CONTACT_VERIFICATION_NOT_FOUND", "확인할 인증번호가 없어요.", 404);
  }

  if (verification.expiresAt.getTime() <= Date.now()) {
    await prisma.userContactVerification.update({
      where: { id: verification.id },
      data: { status: UserContactVerificationStatus.EXPIRED },
    });
    throw new AppError("CONTACT_VERIFICATION_EXPIRED", "인증번호가 만료됐어요. 다시 요청해 주세요.", 410);
  }

  const codeHash = hashOtpCode(contact.id, input.code);

  if (verification.codeHash !== codeHash) {
    const nextAttemptCount = verification.attemptCount + 1;
    await prisma.userContactVerification.update({
      where: { id: verification.id },
      data: {
        attemptCount: nextAttemptCount,
        status:
          nextAttemptCount >= OTP_MAX_ATTEMPTS
            ? UserContactVerificationStatus.EXPIRED
            : UserContactVerificationStatus.PENDING,
      },
    });
    throw new AppError("CONTACT_VERIFICATION_CODE_INVALID", "인증번호가 올바르지 않아요.", 400);
  }

  const verifiedAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.userContactVerification.update({
      where: { id: verification.id },
      data: {
        status: UserContactVerificationStatus.VERIFIED,
        consumedAt: verifiedAt,
      },
    });

    if (contact.type === UserContactType.PHONE) {
      await tx.userContact.updateMany({
        where: {
          userId,
          type: UserContactType.PHONE,
          deletedAt: null,
          verifiedAt: { not: null },
          NOT: { id: contact.id },
        },
        data: {
          deletedAt: verifiedAt,
          isPrimary: false,
        },
      });

      return tx.userContact.update({
        where: { id: contact.id },
        data: {
          verifiedAt,
          verificationSource: "OTP",
          deletedAt: null,
          isPrimary: true,
        },
      });
    }

    const hasPrimary = await tx.userContact.findFirst({
      where: {
        userId,
        deletedAt: null,
        isPrimary: true,
      },
      select: { id: true },
    });

    return tx.userContact.update({
      where: { id: contact.id },
      data: {
        verifiedAt,
        verificationSource: "OTP",
        isPrimary: contact.isPrimary || !hasPrimary,
      },
    });
  });

  return {
    contact: mapContact(updated),
  };
}

export async function updateUserContact(userId: string, contactId: string, input: UpdateUserContactInput) {
  const contact = await findOwnedContact(userId, contactId);
  const label = input.label === undefined ? undefined : normalizeLabel(input.label);

  if (input.isPrimary === true && !contact.verifiedAt) {
    throw new AppError("CONTACT_NOT_VERIFIED", "인증된 연락처만 기본 연락처로 설정할 수 있어요.", 409);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.isPrimary === true) {
      await tx.userContact.updateMany({
        where: {
          userId,
          deletedAt: null,
        },
        data: { isPrimary: false },
      });
    }

    return tx.userContact.update({
      where: { id: contact.id },
      data: {
        ...(label !== undefined ? { label } : {}),
        ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
      },
    });
  });

  return {
    contact: mapContact(updated),
  };
}

export async function deleteUserContact(userId: string, contactId: string) {
  const contact = await findOwnedContact(userId, contactId);

  if (contact.type === UserContactType.PHONE && contact.verifiedAt) {
    throw new AppError(
      "VERIFIED_PHONE_CONTACT_CANNOT_BE_DELETED",
      "인증된 전화번호는 삭제할 수 없어요. 새 전화번호 인증으로 변경해 주세요.",
      403,
    );
  }

  await prisma.userContact.update({
    where: { id: contact.id },
    data: {
      deletedAt: new Date(),
      isPrimary: false,
    },
  });

  const nextPrimary = await prisma.userContact.findFirst({
    where: {
      userId,
      deletedAt: null,
      verifiedAt: { not: null },
    },
    orderBy: { createdAt: "asc" },
  });

  if (nextPrimary) {
    await prisma.userContact.update({
      where: { id: nextPrimary.id },
      data: { isPrimary: true },
    });
  }

  return { deleted: true };
}

export async function assertVerifiedSenderPhoneContact(userId: string) {
  await ensureKakaoEmailContact(userId);

  const contact = await prisma.userContact.findFirst({
    where: {
      userId,
      type: UserContactType.PHONE,
      deletedAt: null,
      verifiedAt: {
        not: null,
      },
      value: {
        startsWith: "010",
      },
    },
    orderBy: [{ isPrimary: "desc" }, { verifiedAt: "desc" }, { updatedAt: "desc" }],
  });

  if (!contact || !isWriteEligiblePhoneContact(contact)) {
    throw new AppError(
      "SENDER_PHONE_VERIFICATION_REQUIRED",
      "마음을 예약하려면 전화번호 인증이 필요해요.",
      409,
    );
  }

  return {
    id: contact.id,
    snapshot: createSenderContactSnapshot(contact),
  };
}

export const assertVerifiedSenderContact = assertVerifiedSenderPhoneContact;

export async function ensureKakaoEmailContact(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
    },
  });
  const normalizedEmail = normalizeOptionalEmailContact(user?.email);

  if (!normalizedEmail) {
    return null;
  }

  const contactHash = hashContact(UserContactType.EMAIL, normalizedEmail);
  const existing = await prisma.userContact.findUnique({
    where: {
      type_contactHash: {
        type: UserContactType.EMAIL,
        contactHash,
      },
    },
  });

  if (existing && existing.userId !== userId) {
    return null;
  }

  const hasPrimary = await prisma.userContact.findFirst({
    where: {
      userId,
      deletedAt: null,
      isPrimary: true,
    },
    select: { id: true },
  });

  if (existing) {
    if (existing.verifiedAt && !existing.deletedAt) {
      return existing;
    }

    return prisma.userContact.update({
      where: { id: existing.id },
      data: {
        value: normalizedEmail,
        verifiedAt: existing.verifiedAt ?? new Date(),
        verificationSource: existing.verificationSource ?? "KAKAO",
        deletedAt: null,
        isPrimary: existing.isPrimary || !hasPrimary,
      },
    });
  }

  return prisma.userContact.create({
    data: {
      userId,
      type: UserContactType.EMAIL,
      value: normalizedEmail,
      contactHash,
      label: "카카오 이메일",
      isPrimary: !hasPrimary,
      verifiedAt: new Date(),
      verificationSource: "KAKAO",
    },
  });
}

function normalizeContactInput(type: "EMAIL" | "PHONE", value: string) {
  if (type === "EMAIL") {
    return normalizeEmailContact(value);
  }

  const normalizedStrictPhone = normalizeStrictKoreanMobilePhone(value);

  if (!normalizedStrictPhone) {
    throw new AppError("CONTACT_PHONE_INVALID", "휴대전화 번호만 인증할 수 있어요.", 400);
  }

  return normalizedStrictPhone;
}

function normalizeLabel(label?: string | null) {
  const value = label?.trim();
  return value && value.length > 0 ? value : null;
}

async function findOwnedContact(userId: string, contactId: string) {
  const contact = await prisma.userContact.findFirst({
    where: {
      id: contactId,
      userId,
      deletedAt: null,
    },
  });

  if (!contact) {
    throw new AppError("CONTACT_NOT_FOUND", "연락처를 찾을 수 없어요.", 404);
  }

  return contact;
}

async function createAndSendVerification(contact: UserContact, context?: RequestContext) {
  const latest = await prisma.userContactVerification.findFirst({
    where: {
      userContactId: contact.id,
      status: UserContactVerificationStatus.PENDING,
    },
    orderBy: { createdAt: "desc" },
  });

  if (latest && latest.createdAt.getTime() > Date.now() - OTP_RESEND_COOLDOWN_MS) {
    throw new AppError("CONTACT_VERIFICATION_COOLDOWN", "인증번호는 1분 뒤 다시 요청할 수 있어요.", 429);
  }

  const phonePreflight =
    contact.type === UserContactType.PHONE
      ? await preparePhoneVerificationPreflight({
          userId: contact.userId,
          normalizedPhone: assertStrictStoredPhone(contact.value),
          ipAddress: context?.ipAddress ?? "unknown",
        })
      : null;
  const code = createOtpCode();
  const verification = await prisma.userContactVerification.create({
    data: {
      userContactId: contact.id,
      codeHash: hashOtpCode(contact.id, code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  const result = await externalNotificationProvider.send({
    channel: contact.type === UserContactType.PHONE ? "SMS" : "EMAIL",
    to: contact.value,
    receiverName: null,
    publicUrl: "",
    subject: "매아리 연락처 인증번호",
    text:
      contact.type === UserContactType.PHONE
        ? `[매아리] 연락처 인증번호는 ${code}입니다. 10분 안에 입력해 주세요.`
        : `매아리 연락처 인증번호는 ${code}입니다.\n10분 안에 입력해 주세요.`,
    html:
      contact.type === UserContactType.EMAIL
        ? `<p>매아리 연락처 인증번호는 <strong>${code}</strong>입니다.</p><p>10분 안에 입력해 주세요.</p>`
        : undefined,
    idempotencyKey: `contact-verification:${verification.id}`,
  });

  if (result.status !== "SENT") {
    await markPhoneVerificationAttemptSendFailed(
      phonePreflight?.attemptId,
      result.errorCode ?? "CONTACT_VERIFICATION_SEND_FAILED",
    );
    await prisma.userContactVerification.update({
      where: { id: verification.id },
      data: { status: UserContactVerificationStatus.EXPIRED },
    });
    throw new AppError(
      "CONTACT_VERIFICATION_SEND_FAILED",
      result.errorMessage ?? "인증번호를 발송하지 못했어요.",
      result.errorCode === "NOTIFICATION_PROVIDER_NOT_CONFIGURED" ? 503 : 502,
      { provider: result.provider, errorCode: result.errorCode },
    );
  }

  await markPhoneVerificationAttemptSent(phonePreflight?.attemptId);
}

function createOtpCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function mapContact(contact: UserContact) {
  return {
    id: contact.id,
    type: contact.type,
    maskedValue: maskContact(contact.type, contact.value),
    label: contact.label,
    isPrimary: contact.isPrimary,
    verifiedAt: contact.verifiedAt,
    verificationSource: contact.verificationSource,
    createdAt: contact.createdAt,
    isWriteEligiblePhone: isWriteEligiblePhoneContact(contact),
  };
}

function createSenderContactSnapshot(contact: UserContact) {
  return {
    type: contact.type,
    maskedValue: maskContact(contact.type, contact.value),
    contactHash: contact.contactHash,
    label: contact.label,
  };
}

function maskContact(type: UserContactType, value: string) {
  if (type === UserContactType.PHONE) {
    return value.length >= 7 ? `${value.slice(0, 3)}****${value.slice(-4)}` : value;
  }

  const [rawLocalPart, domain] = value.split("@");
  const localPart = rawLocalPart ?? "";

  if (!domain || !localPart) {
    return value;
  }

  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

function isWriteEligiblePhoneContact(contact: UserContact) {
  return (
    contact.type === UserContactType.PHONE &&
    Boolean(contact.verifiedAt) &&
    !contact.deletedAt &&
    isStrictKoreanMobilePhone(contact.value)
  );
}

function assertStrictStoredPhone(value: string) {
  if (!isStrictKoreanMobilePhone(value)) {
    throw new AppError("CONTACT_PHONE_INVALID", "휴대전화 번호만 인증할 수 있어요.", 400);
  }

  return value;
}
