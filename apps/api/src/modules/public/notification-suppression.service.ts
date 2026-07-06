import { NotificationChannel } from "@maeari/database";
import { AppError } from "../../lib/app-error.js";
import { normalizeOptionalEmailContact, normalizeOptionalPhoneContact } from "../../lib/contact-normalization.js";
import { prisma } from "../../lib/prisma.js";
import { hashContact, hashPublicToken } from "../../lib/tokens.js";
import type { NotificationSuppressionInput } from "./notification-suppression.validation.js";

export async function createNotificationSuppression(input: NotificationSuppressionInput) {
  const { accessToken, channel, contactHash } = await resolveSuppressionTarget(input);

  await prisma.contactSuppression.upsert({
    where: {
      channel_contactHash: {
        channel,
        contactHash,
      },
    },
    update: {
      sourceMessageRecipientId: accessToken.recipient.id,
      reason: "recipient_requested",
    },
    create: {
      channel,
      contactHash,
      sourceMessageRecipientId: accessToken.recipient.id,
      reason: "recipient_requested",
    },
  });

  return { channel, suppressed: true };
}

export async function deleteNotificationSuppression(input: NotificationSuppressionInput) {
  const { channel, contactHash } = await resolveSuppressionTarget(input);

  await prisma.contactSuppression.deleteMany({
    where: {
      channel,
      contactHash,
    },
  });

  return { channel, suppressed: false };
}

async function resolveSuppressionTarget(input: NotificationSuppressionInput) {
  const tokenHash = hashPublicToken(input.token);
  const accessToken = await prisma.messageAccessToken.findUnique({
    where: { tokenHash },
    include: {
      recipient: {
        select: {
          id: true,
          receiverEmail: true,
          receiverPhone: true,
        },
      },
    },
  });

  if (!accessToken || accessToken.revokedAt) {
    throw new AppError("MESSAGE_TOKEN_NOT_FOUND", "도착한 마음을 찾을 수 없어요.", 404);
  }

  if (accessToken.expiresAt && accessToken.expiresAt < new Date()) {
    throw new AppError("MESSAGE_TOKEN_EXPIRED", "이 마음을 열람할 수 있는 시간이 지났어요.", 410);
  }

  const channel = input.channel === "SMS" ? NotificationChannel.SMS : NotificationChannel.EMAIL;
  const normalizedContact =
    channel === NotificationChannel.SMS
      ? normalizeOptionalPhoneContact(accessToken.recipient.receiverPhone)
      : normalizeOptionalEmailContact(accessToken.recipient.receiverEmail);

  if (!normalizedContact) {
    throw new AppError(
      channel === NotificationChannel.SMS ? "RECEIVER_PHONE_NOT_FOUND" : "RECEIVER_EMAIL_NOT_FOUND",
      channel === NotificationChannel.SMS
        ? "이 링크에는 수신 거부할 전화번호 정보가 없어요."
        : "이 링크에는 수신 거부할 이메일 정보가 없어요.",
      400,
    );
  }

  const contactHash = hashContact(channel, normalizedContact);

  return { accessToken, channel, contactHash };
}
