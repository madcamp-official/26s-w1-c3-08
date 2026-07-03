import {
  ModerationAttemptStatus,
  MessageStatus,
  RecipientDeliveryStatus,
  RecipientType,
} from "@maeum-arrival/database";
import { config } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import { createPublicToken, createTokenPreview, hashPublicToken } from "../../lib/tokens.js";
import {
  getModerationInputHash,
  moderateMessageWithRetry,
  type ModerationResult,
} from "../moderation/moderation.service.js";
import type { CreateMessageInput } from "./message.validation.js";
import { mapMessageListItem, mapReceivedItem, toPublicUrl } from "./message.mapper.js";

export async function createMessage(userId: string, input: CreateMessageInput) {
  const moderationInput = {
    title: input.title,
    content: input.content,
    emotionTag: input.customEmotionTag ?? input.emotionTag,
  };
  const moderation = await moderateMessageWithRetry({
    title: moderationInput.title,
    content: moderationInput.content,
    emotionTag: moderationInput.emotionTag,
  });
  const inputHash = getModerationInputHash(moderationInput);

  if (moderation.allowed === false) {
    throw new AppError("MESSAGE_BLOCKED_BY_MODERATION", moderation.feedback, 422, {
      blockedCategories: moderation.blockedCategories,
    });
  }

  const receiver = normalizeReceiver(input, userId);

  if (moderation.allowed === "unavailable") {
    const message = await prisma.message.create({
      data: {
        senderId: userId,
        title: input.title,
        content: input.content,
        emotionTag: input.emotionTag,
        customEmotionTag: input.customEmotionTag,
        scheduledAt: new Date(input.scheduledAt),
        isSenderHidden: input.isSenderHidden,
        isDateHidden: input.isDateHidden,
        status: MessageStatus.MODERATION_FAILED,
        moderationAttemptCount: config.moderationMaxAttempts,
        moderationLastCheckedAt: new Date(),
        moderationNextRetryAt: moderation.retryAfter,
        moderationFailureReason: moderation.reason,
        recipients: {
          create: receiver,
        },
      },
    });

    await createModerationLog(message.id, moderation, config.moderationMaxAttempts, inputHash);

    return {
      message,
      publicUrl: null,
      notice: "안전 검사를 잠시 완료하지 못했어요. 작성한 마음은 임시로 보관했고, 하루에 한 번 자동으로 다시 검사할게요.",
    };
  }

  const rawToken = createPublicToken();
  const message = await prisma.message.create({
    data: {
      senderId: userId,
      title: input.title,
      content: input.content,
      emotionTag: input.emotionTag,
      customEmotionTag: input.customEmotionTag,
      scheduledAt: new Date(input.scheduledAt),
      isSenderHidden: input.isSenderHidden,
      isDateHidden: input.isDateHidden,
      status: MessageStatus.PENDING,
      moderationAttemptCount: 1,
      moderationLastCheckedAt: new Date(),
      recipients: {
        create: {
          ...receiver,
          accessTokens: {
            create: {
              tokenHash: hashPublicToken(rawToken),
              tokenPreview: createTokenPreview(rawToken),
            },
          },
        },
      },
    },
  });

  await createModerationLog(message.id, moderation, 1, inputHash);

  return {
    message,
    publicUrl: toPublicUrl(rawToken),
  };
}

export async function listSentMessages(userId: string) {
  const messages = await prisma.message.findMany({
    where: { senderId: userId },
    include: {
      recipients: {
        include: {
          accessTokens: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return messages.map(mapMessageListItem);
}

export async function createMessagePublicLink(userId: string, messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      recipients: {
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  if (!message) {
    throw new AppError("MESSAGE_NOT_FOUND", "메시지를 찾을 수 없어요.", 404);
  }

  if (message.senderId !== userId) {
    throw new AppError("MESSAGE_FORBIDDEN", "이 메시지의 링크를 만들 권한이 없어요.", 403);
  }

  if (
    message.status === MessageStatus.MODERATION_FAILED ||
    message.status === MessageStatus.BLOCKED ||
    message.status === MessageStatus.CANCELED ||
    message.status === MessageStatus.FAILED
  ) {
    throw new AppError("PUBLIC_LINK_UNAVAILABLE", "지금은 공개 링크를 만들 수 없는 메시지예요.", 409);
  }

  const recipient = message.recipients[0];

  if (!recipient) {
    throw new AppError("MESSAGE_RECIPIENT_NOT_FOUND", "수신자 정보를 찾을 수 없어요.", 404);
  }

  const rawToken = createPublicToken();

  await prisma.messageAccessToken.create({
    data: {
      messageRecipientId: recipient.id,
      tokenHash: hashPublicToken(rawToken),
      tokenPreview: createTokenPreview(rawToken),
    },
  });

  return {
    publicUrl: toPublicUrl(rawToken),
  };
}

export async function listReceivedMessages(userId: string) {
  const recipients = await prisma.messageRecipient.findMany({
    where: {
      receiverUserId: userId,
      message: {
        status: MessageStatus.SENT,
      },
    },
    include: {
      accessTokens: {
        where: {
          linkedUserId: userId,
        },
        select: {
          linkedAt: true,
          linkedUserId: true,
        },
      },
      message: {
        include: {
          sender: {
            select: {
              id: true,
              nickname: true,
            },
          },
        },
      },
    },
    orderBy: [{ deliveredAt: "desc" }, { createdAt: "desc" }],
  });

  return recipients.map(mapReceivedItem);
}

export async function getMessageDetail(userId: string, messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      sender: {
        select: {
          id: true,
          nickname: true,
        },
      },
      recipients: {
        include: {
          accessTokens: true,
        },
      },
    },
  });

  if (!message) {
    throw new AppError("MESSAGE_NOT_FOUND", "메시지를 찾을 수 없어요.", 404);
  }

  const isSender = message.senderId === userId;
  const recipient = message.recipients.find((item) => item.receiverUserId === userId);

  if (!isSender && !recipient) {
    throw new AppError("MESSAGE_FORBIDDEN", "이 메시지를 볼 권한이 없어요.", 403);
  }

  if (!isSender && message.status !== MessageStatus.SENT) {
    throw new AppError("MESSAGE_NOT_ARRIVED", "아직 도착하지 않은 마음이에요.", 403);
  }

  if (recipient && !recipient.readAt && message.status === MessageStatus.SENT) {
    await prisma.messageRecipient.update({
      where: { id: recipient.id },
      data: { readAt: new Date() },
    });
  }

  return {
    id: message.id,
    title: message.title,
    content: message.content,
    emotionTag: message.emotionTag,
    customEmotionTag: message.customEmotionTag,
    scheduledAt: isSender || !message.isDateHidden ? message.scheduledAt : null,
    sentAt: isSender || !message.isDateHidden ? message.sentAt : null,
    status: message.status,
    isSenderHidden: message.isSenderHidden,
    isDateHidden: message.isDateHidden,
    senderName: !message.isSenderHidden || isSender ? message.sender.nickname : null,
    recipients: isSender
      ? message.recipients.map((item) => ({
          id: item.id,
          name: item.receiverName,
          email: item.receiverEmail,
          phone: item.receiverPhone,
          type: item.receiverType,
          deliveryStatus: item.deliveryStatus,
          deliveredAt: item.deliveredAt,
          readAt: item.readAt,
          hasPublicLink: item.accessTokens.some((token) => !token.revokedAt),
        }))
      : [],
    moderationNextRetryAt: message.moderationNextRetryAt,
  };
}

export async function cancelMessage(userId: string, messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      senderId: true,
      status: true,
    },
  });

  if (!message) {
    throw new AppError("MESSAGE_NOT_FOUND", "메시지를 찾을 수 없어요.", 404);
  }

  if (message.senderId !== userId) {
    throw new AppError("MESSAGE_FORBIDDEN", "이 메시지를 취소할 권한이 없어요.", 403);
  }

  if (
    message.status !== MessageStatus.PENDING &&
    message.status !== MessageStatus.MODERATION_FAILED
  ) {
    throw new AppError("MESSAGE_NOT_CANCELABLE", "이미 처리된 메시지는 취소할 수 없어요.", 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.message.update({
      where: { id: message.id },
      data: {
        status: MessageStatus.CANCELED,
        canceledAt: new Date(),
      },
    });

    await tx.messageRecipient.updateMany({
      where: { messageId: message.id },
      data: { deliveryStatus: RecipientDeliveryStatus.CANCELED },
    });

    const recipients = await tx.messageRecipient.findMany({
      where: { messageId: message.id },
      select: { id: true },
    });

    await tx.messageAccessToken.updateMany({
      where: {
        messageRecipientId: {
          in: recipients.map((recipient) => recipient.id),
        },
      },
      data: { revokedAt: new Date() },
    });
  });

  return { canceled: true };
}

async function createModerationLog(messageId: string, moderation: ModerationResult, attemptNo: number, inputHash: string) {
  if (moderation.allowed === true) {
    await prisma.moderationLog.create({
      data: {
        messageId,
        attemptNo,
        model: config.openaiModerationModel,
        status: ModerationAttemptStatus.APPROVED,
        inputHash,
        categories: moderation.categories,
        categoryScores: moderation.categoryScores,
      },
    });
    return;
  }

  if (moderation.allowed === false) {
    await prisma.moderationLog.create({
      data: {
        messageId,
        attemptNo,
        model: config.openaiModerationModel,
        status: ModerationAttemptStatus.BLOCKED,
        inputHash,
        categories: moderation.categories,
        categoryScores: moderation.categoryScores,
        feedback: moderation.feedback,
      },
    });
    return;
  }

  await prisma.moderationLog.create({
    data: {
      messageId,
      attemptNo,
      model: config.openaiModerationModel,
      status: ModerationAttemptStatus.FAILED,
      inputHash,
      errorMessage: moderation.reason,
    },
  });
}

function normalizeReceiver(input: CreateMessageInput, userId: string) {
  const receiverType = input.receiverInfo.type === "SELF" ? RecipientType.SELF : RecipientType.OTHER;
  const receiverName = input.receiverInfo.type === "SELF" ? "미래의 나" : input.receiverInfo.name;

  return {
    receiverUserId: input.receiverInfo.type === "SELF" ? userId : undefined,
    receiverType,
    receiverName,
    receiverEmail: normalizeOptional(input.receiverInfo.email),
    receiverPhone: normalizeOptional(input.receiverInfo.phone),
    receiverInfo: {
      type: input.receiverInfo.type,
      name: receiverName,
      email: normalizeOptional(input.receiverInfo.email),
      phone: normalizeOptional(input.receiverInfo.phone),
    },
  };
}

function normalizeOptional(value?: string) {
  return value && value.trim().length > 0 ? value.trim() : undefined;
}
