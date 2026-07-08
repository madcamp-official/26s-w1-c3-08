import { MessageStatus, NotificationChannel, RecipientDeliveryStatus } from "@maeari/database";
import { AppError } from "../../lib/app-error.js";
import { normalizeOptionalEmailContact, normalizeOptionalPhoneContact } from "../../lib/contact-normalization.js";
import { MESSAGE_REPLY_CREATED_EVENT, domainEvents } from "../../events/domain-events.js";
import { prisma } from "../../lib/prisma.js";
import { hashContact, hashPublicToken } from "../../lib/tokens.js";
import { getDisplayCustomEmotionTag } from "../messages/emotion-tags.js";
import { getMessageThemeEnvelope } from "../messages/message.mapper.js";
import { getModerationInputHash, moderateMessageWithRetry } from "../moderation/moderation.service.js";

export async function getPublicMessage(rawToken: string) {
  if (!rawToken) {
    throw new AppError("MESSAGE_TOKEN_REQUIRED", "도착한 마음의 링크 정보를 찾을 수 없어요.", 400);
  }

  const tokenHash = hashPublicToken(rawToken);
  const accessToken = await prisma.messageAccessToken.findUnique({
    where: { tokenHash },
    include: {
      recipient: {
        include: {
          message: {
            include: {
              sender: {
                select: {
                  id: true,
                  nickname: true,
                },
              },
              attachments: {
                orderBy: { createdAt: "asc" },
              },
            },
          },
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

  const message = accessToken.recipient.message;

  if (message.status === MessageStatus.PENDING) {
    throw new AppError("MESSAGE_NOT_ARRIVED", "아직 도착하지 않은 마음이에요.", 403, {
      scheduledAt: message.isDateHidden ? null : message.scheduledAt,
    });
  }

  if (message.status !== MessageStatus.SENT) {
    throw new AppError("MESSAGE_UNAVAILABLE", "지금은 이 마음을 열람할 수 없어요.", 409);
  }

  if (accessToken.recipient.deliveryStatus !== RecipientDeliveryStatus.SENT) {
    throw new AppError("MESSAGE_UNAVAILABLE", "지금은 이 마음을 열람할 수 없어요.", 409);
  }

  const [isEmailNotificationSuppressed, isSmsNotificationSuppressed] = await Promise.all([
    isContactSuppressed(NotificationChannel.EMAIL, accessToken.recipient.receiverEmail),
    isContactSuppressed(NotificationChannel.SMS, accessToken.recipient.receiverPhone),
  ]);

  await prisma.messageAccessToken.update({
    where: { tokenHash },
    data: {
      openCount: { increment: 1 },
      firstOpenedAt: accessToken.firstOpenedAt ?? new Date(),
      lastOpenedAt: new Date(),
    },
  });

  return {
    id: message.id,
    title: message.title,
    content: message.content,
    emotionTag: message.emotionTag,
    customEmotionTag: getDisplayCustomEmotionTag(message.emotionTag, message.customEmotionTag),
    theme: message.theme,
    themeEnvelope: getMessageThemeEnvelope(message.theme),
    attachments: message.attachments.map((attachment) => ({
      id: attachment.id,
      publicUrl: attachment.publicUrl,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    })),
    senderName: message.isSenderHidden ? null : message.senderDisplayName ?? message.sender.nickname,
    arrivedAt: message.isDateHidden ? null : message.sentAt,
    isSenderHidden: message.isSenderHidden,
    isDateHidden: message.isDateHidden,
    linked: Boolean(accessToken.linkedUserId),
    canReply: message.isReplyEnabled,
    canSuppressEmailNotification: Boolean(accessToken.recipient.receiverEmail),
    canSuppressSmsNotification: Boolean(accessToken.recipient.receiverPhone),
    isEmailNotificationSuppressed,
    isSmsNotificationSuppressed,
  };
}

async function isContactSuppressed(channel: NotificationChannel, contact?: string | null) {
  const normalizedContact =
    channel === NotificationChannel.EMAIL
      ? normalizeOptionalEmailContact(contact)
      : normalizeOptionalPhoneContact(contact);

  if (!normalizedContact) {
    return false;
  }

  const contactHash = hashContact(channel, normalizedContact);
  const suppression = await prisma.contactSuppression.findUnique({
    where: {
      channel_contactHash: {
        channel,
        contactHash,
      },
    },
  });

  return Boolean(suppression);
}

export async function createPublicMessageReply(
  rawToken: string,
  input: {
    content: string;
    senderDisplayName?: string | null;
    isAnonymous?: boolean;
  },
) {
  const content = input.content.trim();

  if (content.length < 1 || content.length > 2000) {
    throw new AppError("REPLY_CONTENT_INVALID", "답장은 1자 이상 2000자 이하로 적어 주세요.", 400);
  }

  const tokenHash = hashPublicToken(rawToken);
  const accessToken = await prisma.messageAccessToken.findUnique({
    where: { tokenHash },
    include: {
      recipient: {
        include: {
          message: true,
        },
      },
    },
  });

  if (!accessToken || accessToken.revokedAt) {
    throw new AppError("MESSAGE_TOKEN_NOT_FOUND", "도착한 마음을 찾을 수 없어요.", 404);
  }

  const message = accessToken.recipient.message;

  if (message.status !== MessageStatus.SENT) {
    throw new AppError("MESSAGE_NOT_ARRIVED", "아직 답장을 보낼 수 없는 마음이에요.", 403);
  }

  if (!message.isReplyEnabled) {
    throw new AppError("REPLY_DISABLED", "이 마음에는 답장을 보낼 수 없어요.", 409);
  }

  const moderationInput = {
    title: "익명 답장",
    content,
    emotionTag: "reply",
  };
  const moderation = await moderateMessageWithRetry(moderationInput);

  if (moderation.allowed === false) {
    throw new AppError("REPLY_BLOCKED_BY_MODERATION", moderation.feedback, 422, {
      blockedCategories: moderation.blockedCategories,
    });
  }

  if (moderation.allowed === "unavailable") {
    throw new AppError("REPLY_MODERATION_UNAVAILABLE", "지금은 답장 안전 검사를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.", 503);
  }

  const isAnonymous = input.isAnonymous ?? true;
  const reply = await prisma.messageReply.create({
    data: {
      messageId: message.id,
      messageRecipientId: accessToken.recipient.id,
      content,
      senderDisplayName: isAnonymous ? null : input.senderDisplayName?.trim() || null,
      isAnonymous,
      moderationInputHash: getModerationInputHash(moderationInput),
      moderationCategories: moderation.categories,
    },
  });

  domainEvents.emit(MESSAGE_REPLY_CREATED_EVENT, {
    replyId: reply.id,
    messageId: message.id,
    messageRecipientId: accessToken.recipient.id,
    createdAt: reply.createdAt,
  });

  return {
    reply: {
      id: reply.id,
      content: reply.content,
      senderDisplayName: reply.isAnonymous ? null : reply.senderDisplayName,
      isAnonymous: reply.isAnonymous,
      createdAt: reply.createdAt,
    },
  };
}

export async function createPublicMessageReport(
  rawToken: string,
  input: {
    reason: string;
    details?: string | null;
  },
) {
  const reason = normalizeReportReason(input.reason);
  const tokenHash = hashPublicToken(rawToken);
  const accessToken = await prisma.messageAccessToken.findUnique({
    where: { tokenHash },
    include: {
      recipient: true,
    },
  });

  if (!accessToken || accessToken.revokedAt) {
    throw new AppError("MESSAGE_TOKEN_NOT_FOUND", "도착한 마음을 찾을 수 없어요.", 404);
  }

  const report = await prisma.messageReport.create({
    data: {
      messageId: accessToken.recipient.messageId,
      messageRecipientId: accessToken.recipient.id,
      reason,
      details: input.details?.trim() || null,
    },
  });

  return {
    report: {
      id: report.id,
      status: report.status,
    },
  };
}

function normalizeReportReason(value: string) {
  const reason = value.trim();

  if (reason.length < 1 || reason.length > 80) {
    throw new AppError("REPORT_REASON_INVALID", "신고 사유를 선택해 주세요.", 400);
  }

  return reason;
}
