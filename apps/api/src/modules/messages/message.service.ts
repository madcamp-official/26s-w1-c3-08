import {
  AttachmentOcrStatus,
  CommunicationBlockDirection,
  MessageArrivalMode,
  MessageReplyStatus,
  ModerationAttemptStatus,
  MessageStatus,
  MessageTheme,
  NotificationChannel,
  NotificationEventType,
  RecipientDeliveryStatus,
  RecipientType,
  UserContactType,
} from "@maeari/database";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../../config/env.js";
import { MESSAGE_REPLY_CREATED_EVENT, domainEvents } from "../../events/domain-events.js";
import { AppError } from "../../lib/app-error.js";
import { normalizeOptionalEmailContact, normalizeOptionalPhoneContact } from "../../lib/contact-normalization.js";
import { prisma } from "../../lib/prisma.js";
import { createPublicToken, createTokenPreview, hashContact, hashPublicToken } from "../../lib/tokens.js";
import {
  getModerationInputHash,
  moderateMessageWithRetry,
  type ModerationResult,
} from "../moderation/moderation.service.js";
import {
  analyzeDraftAttachmentsForOcr,
  buildAttachmentOcrText,
  hasFailedOcr,
  mergeContentWithOcrText,
  type AttachmentOcrResult,
} from "../moderation/image-ocr.service.js";
import { assertActiveFriendship } from "../friends/friend.service.js";
import { assertVerifiedSenderPhoneContact } from "../contacts/contact.service.js";
import {
  assertCommunicationAllowedBetweenUsers,
  findCommunicationBlock,
  getCommunicationBlockDetails,
  getContactCommunicationTargets,
  getUserCommunicationTarget,
  mergeCommunicationTargets,
  type CommunicationTargetReference,
} from "../communication-blocks/communication-block.service.js";
import type { CreateMessageInput, CreateMessageReplyInput } from "./message.validation.js";
import { getMessageThemeEnvelope, mapMessageListItem, mapReceivedItem, toPublicUrl } from "./message.mapper.js";

export async function createMessage(userId: string, input: CreateMessageInput) {
  const messageId = crypto.randomUUID();
  const schedule = resolveSchedule(input);
  const sender = await getMessageSender(userId);
  const senderDisplayName = normalizeDisplayName(input.senderDisplayName, sender.nickname);
  const senderContact = await assertVerifiedSenderPhoneContact(userId);
  const receiverInputs = getReceiverInputs(input);
  const receivers = await Promise.all(receiverInputs.map((receiverInput) => normalizeReceiver(receiverInput, userId)));
  await assertMessageReceiversCommunicationAllowed(userId, receivers);
  const attachmentOcrResults = await analyzeDraftAttachmentsForOcr(input.attachments ?? []);
  const attachmentOcrText = buildAttachmentOcrText(attachmentOcrResults);
  const moderationInput = {
    title: input.title,
    content: mergeContentWithOcrText(input.content, attachmentOcrText),
    emotionTag: input.customEmotionTag ?? input.emotionTag,
  };
  const moderation = hasFailedOcr(attachmentOcrResults)
    ? createOcrUnavailableResult(attachmentOcrResults)
    : await moderateMessageWithRetry({
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

  const attachments = await persistAttachments(messageId, input.attachments ?? [], attachmentOcrResults);

  if (moderation.allowed === "unavailable") {
    const message = await prisma.message.create({
      data: {
        id: messageId,
        senderId: userId,
        senderContactId: senderContact.id,
        senderContactSnapshot: senderContact.snapshot,
        senderDisplayName,
        title: input.title,
        content: input.content,
        emotionTag: input.emotionTag,
        customEmotionTag: input.customEmotionTag,
        scheduledAt: schedule.scheduledAt,
        arrivalMode: schedule.arrivalMode,
        arrivalWindowStartAt: schedule.arrivalWindowStartAt,
        arrivalWindowEndAt: schedule.arrivalWindowEndAt,
        hintAt: input.hintAt ? new Date(input.hintAt) : undefined,
        theme: input.theme ?? MessageTheme.LAVENDER,
        isReplyEnabled: input.isReplyEnabled ?? true,
        isSenderHidden: input.isSenderHidden,
        isDateHidden: input.isDateHidden,
        status: MessageStatus.MODERATION_FAILED,
        moderationAttemptCount: config.moderationMaxAttempts,
        moderationLastCheckedAt: new Date(),
        moderationNextRetryAt: moderation.retryAfter,
        moderationFailureReason: moderation.reason,
        recipients: {
          create: receivers,
        },
        attachments: {
          create: attachments,
        },
      },
    });

    await createModerationLog(message.id, moderation, config.moderationMaxAttempts, inputHash);

    return {
      message: {
        ...message,
        themeEnvelope: getMessageThemeEnvelope(message.theme),
      },
      publicUrl: null,
      notice: "안전 검사를 잠시 완료하지 못했어요. 작성한 마음은 임시로 보관했고, 하루에 한 번 자동으로 다시 검사할게요.",
    };
  }

  const rawTokens = receivers.map(() => createPublicToken());
  const message = await prisma.message.create({
    data: {
      id: messageId,
      senderId: userId,
      senderContactId: senderContact.id,
      senderContactSnapshot: senderContact.snapshot,
      senderDisplayName,
      title: input.title,
      content: input.content,
      emotionTag: input.emotionTag,
      customEmotionTag: input.customEmotionTag,
      scheduledAt: schedule.scheduledAt,
      arrivalMode: schedule.arrivalMode,
      arrivalWindowStartAt: schedule.arrivalWindowStartAt,
      arrivalWindowEndAt: schedule.arrivalWindowEndAt,
      hintAt: input.hintAt ? new Date(input.hintAt) : undefined,
      theme: input.theme ?? MessageTheme.LAVENDER,
      isReplyEnabled: input.isReplyEnabled ?? true,
      isSenderHidden: input.isSenderHidden,
      isDateHidden: input.isDateHidden,
      status: MessageStatus.PENDING,
      moderationAttemptCount: 1,
      moderationLastCheckedAt: new Date(),
      recipients: {
        create: receivers.map((receiver, index) => ({
          ...receiver,
          accessTokens: {
            create: {
              tokenHash: hashPublicToken(rawTokens[index] ?? createPublicToken()),
              tokenPreview: createTokenPreview(rawTokens[index] ?? ""),
            },
          },
        })),
      },
      attachments: {
        create: attachments,
      },
    },
  });

  await createModerationLog(message.id, moderation, 1, inputHash);

  return {
    message: {
      ...message,
      themeEnvelope: getMessageThemeEnvelope(message.theme),
    },
    publicUrl: toPublicUrl(rawTokens[0]),
    publicUrls: rawTokens.map((token, index) => ({
      receiverName: receivers[index]?.receiverName ?? null,
      publicUrl: toPublicUrl(token),
    })),
  };
}

export async function listSentMessages(userId: string) {
  const messages = await prisma.message.findMany({
    where: {
      senderId: userId,
      senderDeletedAt: null,
    },
    include: {
      recipients: {
        include: {
          accessTokens: true,
        },
        orderBy: { createdAt: "asc" },
      },
      attachments: {
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return messages.map(mapMessageListItem);
}

export async function listSentMessageReplies(userId: string) {
  return listReceivedMessageReplies(userId);
}

export async function listReceivedMessageReplies(userId: string) {
  const replies = await prisma.messageReply.findMany({
    where: {
      status: MessageReplyStatus.VISIBLE,
      senderDeletedAt: null,
      message: {
        senderId: userId,
        senderDeletedAt: null,
      },
    },
    include: {
      message: {
        select: {
          id: true,
          title: true,
        },
      },
      recipient: {
        select: {
          receiverName: true,
          receiverType: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return replies.map((reply) => ({
    replyId: reply.id,
    messageId: reply.messageId,
    messageTitle: reply.message.title,
    senderDisplayName: reply.isAnonymous ? null : reply.senderDisplayName,
    isAnonymous: reply.isAnonymous,
    preview: reply.content.slice(0, 140),
    createdAt: reply.createdAt,
    senderReadAt: reply.senderReadAt,
    receiverName: reply.recipient.receiverName,
    receiverType: reply.recipient.receiverType,
  }));
}

export async function listAuthoredMessageReplies(userId: string) {
  const replies = await prisma.messageReply.findMany({
    where: {
      authorUserId: userId,
      authorDeletedAt: null,
      status: MessageReplyStatus.VISIBLE,
      recipient: {
        receiverDeletedAt: null,
      },
    },
    include: {
      message: {
        select: {
          id: true,
          title: true,
          senderDisplayName: true,
          isSenderHidden: true,
          sender: {
            select: {
              nickname: true,
            },
          },
        },
      },
      recipient: {
        select: {
          receiverName: true,
          receiverType: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return replies.map((reply) => ({
    replyId: reply.id,
    messageId: reply.messageId,
    messageTitle: reply.message.title,
    senderName: reply.message.isSenderHidden
      ? null
      : reply.message.senderDisplayName ?? reply.message.sender.nickname,
    preview: reply.content.slice(0, 140),
    createdAt: reply.createdAt,
    isAnonymous: reply.isAnonymous,
    senderDisplayName: reply.isAnonymous ? null : reply.senderDisplayName,
    receiverName: reply.recipient.receiverName,
    receiverType: reply.recipient.receiverType,
  }));
}

export async function createAuthenticatedMessageReply(
  userId: string,
  messageId: string,
  input: CreateMessageReplyInput,
) {
  const content = input.content.trim();
  const recipient = await prisma.messageRecipient.findFirst({
    where: {
      messageId,
      receiverUserId: userId,
      receiverDeletedAt: null,
      message: {
        status: MessageStatus.SENT,
      },
    },
    include: {
      message: {
        select: {
          id: true,
          senderId: true,
          isReplyEnabled: true,
        },
      },
    },
  });

  if (!recipient) {
    throw new AppError("MESSAGE_FORBIDDEN", "이 마음에 답장할 권한이 없어요.", 403);
  }

  if (!recipient.message.isReplyEnabled) {
    throw new AppError("REPLY_DISABLED", "이 마음에는 답장을 보낼 수 없어요.", 409);
  }

  await assertCommunicationAllowedBetweenUsers(
    userId,
    recipient.message.senderId,
    {
      errorCode: "REPLY_COMMUNICATION_BLOCKED",
      message: "송수신 거부 설정으로 답장을 보낼 수 없어요.",
    },
  );

  const moderationInput = {
    title: "답장",
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

  const author = await getMessageSender(userId);
  const isAnonymous = input.isAnonymous ?? true;
  const reply = await prisma.messageReply.create({
    data: {
      messageId: recipient.messageId,
      messageRecipientId: recipient.id,
      authorUserId: userId,
      content,
      senderDisplayName: isAnonymous ? null : normalizeDisplayName(input.senderDisplayName, author.nickname),
      isAnonymous,
      moderationInputHash: getModerationInputHash(moderationInput),
      moderationCategories: moderation.categories,
    },
  });

  domainEvents.emit(MESSAGE_REPLY_CREATED_EVENT, {
    replyId: reply.id,
    messageId: recipient.messageId,
    messageRecipientId: recipient.id,
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

export async function markSentReplyRead(userId: string, replyId: string) {
  const reply = await findOwnedSentReply(userId, replyId);
  const readAt = reply.senderReadAt ?? new Date();

  if (!reply.senderReadAt) {
    await prisma.messageReply.update({
      where: { id: reply.id },
      data: { senderReadAt: readAt },
    });
  }

  await prisma.notificationLog.updateMany({
    where: {
      targetUserId: userId,
      messageReplyId: reply.id,
      eventType: NotificationEventType.REPLY_RECEIVED,
      channel: NotificationChannel.IN_APP,
      readAt: null,
    },
    data: { readAt },
  });

  return { read: true };
}

export async function deleteSentReply(userId: string, replyId: string) {
  const reply = await findOwnedSentReply(userId, replyId);

  if (!reply.senderDeletedAt) {
    await prisma.messageReply.update({
      where: { id: reply.id },
      data: { senderDeletedAt: new Date() },
    });
  }

  return { deleted: true };
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
      receiverDeletedAt: null,
      receiverArchivedAt: null,
      message: {
        status: MessageStatus.SENT,
        senderDeletedAt: null,
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
          attachments: {
            orderBy: { createdAt: "asc" },
            take: 1,
          },
          _count: {
            select: {
              attachments: true,
            },
          },
        },
      },
    },
    orderBy: [{ deliveredAt: "desc" }, { createdAt: "desc" }],
  });

  return recipients.map(mapReceivedItem);
}

export async function listArchivedMessages(userId: string) {
  const recipients = await prisma.messageRecipient.findMany({
    where: {
      receiverUserId: userId,
      receiverDeletedAt: null,
      receiverArchivedAt: {
        not: null,
      },
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
          attachments: {
            orderBy: { createdAt: "asc" },
            take: 1,
          },
          _count: {
            select: {
              attachments: true,
            },
          },
        },
      },
    },
    orderBy: [{ receiverArchivedAt: "desc" }, { createdAt: "desc" }],
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
          notifications: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      attachments: {
        orderBy: { createdAt: "asc" },
      },
      replies: {
        where: { status: "VISIBLE" },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!message) {
    throw new AppError("MESSAGE_NOT_FOUND", "메시지를 찾을 수 없어요.", 404);
  }

  const isSender = message.senderId === userId;
  const recipient = message.recipients.find((item) => item.receiverUserId === userId && !item.receiverDeletedAt);

  if ((isSender && message.senderDeletedAt) || (!isSender && !recipient)) {
    throw new AppError("MESSAGE_FORBIDDEN", "이 메시지를 볼 권한이 없어요.", 403);
  }

  if (!isSender && message.status !== MessageStatus.SENT) {
    throw new AppError("MESSAGE_NOT_ARRIVED", "아직 도착하지 않은 마음이에요.", 403);
  }

  if (recipient && !recipient.readAt && message.status === MessageStatus.SENT) {
    const readAt = new Date();
    await prisma.messageRecipient.update({
      where: { id: recipient.id },
      data: { readAt },
    });
    await prisma.notificationLog.updateMany({
      where: {
        targetUserId: userId,
        messageRecipientId: recipient.id,
        channel: NotificationChannel.IN_APP,
        readAt: null,
      },
      data: { readAt },
    });
  }

  if (isSender) {
    const readAt = new Date();
    await prisma.messageReply.updateMany({
      where: {
        messageId: message.id,
        status: MessageReplyStatus.VISIBLE,
        senderDeletedAt: null,
        senderReadAt: null,
      },
      data: { senderReadAt: readAt },
    });
    await prisma.notificationLog.updateMany({
      where: {
        targetUserId: userId,
        eventType: NotificationEventType.REPLY_RECEIVED,
        channel: NotificationChannel.IN_APP,
        messageReplyId: {
          in: message.replies
            .filter((reply) => !reply.senderDeletedAt && !reply.senderReadAt)
            .map((reply) => reply.id),
        },
        readAt: null,
      },
      data: { readAt },
    });
  }

  return {
    id: message.id,
    title: message.title,
    content: message.content,
    emotionTag: message.emotionTag,
    customEmotionTag: message.customEmotionTag,
    theme: message.theme,
    themeEnvelope: getMessageThemeEnvelope(message.theme),
    arrivalMode: message.arrivalMode,
    arrivalWindowStartAt: message.arrivalWindowStartAt,
    arrivalWindowEndAt: message.arrivalWindowEndAt,
    hintAt: message.hintAt,
    hintSentAt: message.hintSentAt,
    isReplyEnabled: message.isReplyEnabled,
    scheduledAt: isSender || !message.isDateHidden ? message.scheduledAt : null,
    sentAt: isSender || !message.isDateHidden ? message.sentAt : null,
    status: message.status,
    viewerRole: isSender ? "SENDER" : "RECIPIENT",
    canCancel:
      isSender &&
      (message.status === MessageStatus.PENDING || message.status === MessageStatus.MODERATION_FAILED),
    canDeleteFromMailbox: isSender ? isSenderDeletableStatus(message.status) : Boolean(recipient),
    isSenderHidden: message.isSenderHidden,
    isDateHidden: message.isDateHidden,
    senderName: message.isSenderHidden ? null : message.senderDisplayName ?? message.sender.nickname,
    attachments: message.attachments.map((attachment) => ({
      id: attachment.id,
      publicUrl: attachment.publicUrl,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    })),
    replies: (isSender
      ? message.replies.filter((reply) => !reply.senderDeletedAt)
      : message.replies.filter((reply) => reply.messageRecipientId === recipient?.id)
    ).map((reply) => ({
        id: reply.id,
        content: reply.content,
        senderDisplayName: reply.isAnonymous ? null : reply.senderDisplayName,
        isAnonymous: reply.isAnonymous,
        isMine: reply.authorUserId === userId,
        senderReadAt: reply.senderReadAt,
        createdAt: reply.createdAt,
      })),
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
          latestNotification: item.notifications[0]
            ? {
                channel: item.notifications[0].channel,
                status: item.notifications[0].status,
                errorCode: item.notifications[0].errorCode,
                errorMessage: item.notifications[0].errorMessage,
                attemptedAt: item.notifications[0].attemptedAt,
                sentAt: item.notifications[0].sentAt,
              }
            : null,
        }))
      : [],
    moderationNextRetryAt: message.moderationNextRetryAt,
  };
}

async function findOwnedSentReply(userId: string, replyId: string) {
  const reply = await prisma.messageReply.findFirst({
    where: {
      id: replyId,
      status: MessageReplyStatus.VISIBLE,
      senderDeletedAt: null,
      message: {
        senderId: userId,
      },
    },
    select: {
      id: true,
      senderReadAt: true,
      senderDeletedAt: true,
    },
  });

  if (!reply) {
    throw new AppError("MESSAGE_REPLY_NOT_FOUND", "답장을 찾을 수 없어요.", 404);
  }

  return reply;
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

export async function deleteMessageFromMailbox(userId: string, messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      recipients: {
        select: {
          id: true,
          receiverUserId: true,
          receiverDeletedAt: true,
        },
      },
    },
  });

  if (!message) {
    throw new AppError("MESSAGE_NOT_FOUND", "메시지를 찾을 수 없어요.", 404);
  }

  if (message.senderId === userId) {
    if (
      message.status === MessageStatus.PENDING ||
      message.status === MessageStatus.MODERATION_FAILED ||
      message.status === MessageStatus.CANCELED
    ) {
      await prisma.message.delete({
        where: { id: message.id },
      });

      return { deleted: true };
    }

    if (message.status === MessageStatus.SENT || message.status === MessageStatus.FAILED) {
      if (!message.senderDeletedAt) {
        await prisma.message.update({
          where: { id: message.id },
          data: { senderDeletedAt: new Date() },
        });
      }

      return { deleted: true };
    }

    throw new AppError("MESSAGE_NOT_DELETABLE", "이 상태의 메시지는 보낸 마음에서 삭제할 수 없어요.", 409);
  }

  const recipient = message.recipients.find((item) => item.receiverUserId === userId);

  if (!recipient) {
    throw new AppError("MESSAGE_FORBIDDEN", "이 메시지를 삭제할 권한이 없어요.", 403);
  }

  if (!recipient.receiverDeletedAt) {
    await prisma.messageRecipient.update({
      where: { id: recipient.id },
      data: { receiverDeletedAt: new Date() },
    });
  }

  return { deleted: true };
}

export async function bulkDeleteMessagesFromMailbox(userId: string, messageIds: string[]) {
  const uniqueIds = [...new Set(messageIds)].filter(Boolean).slice(0, 100);
  const results = [];

  for (const messageId of uniqueIds) {
    try {
      await deleteMessageFromMailbox(userId, messageId);
      results.push({ id: messageId, deleted: true });
    } catch (error) {
      results.push({
        id: messageId,
        deleted: false,
        errorCode: error instanceof AppError ? error.code : "DELETE_FAILED",
        errorMessage: error instanceof Error ? error.message : "삭제하지 못했어요.",
      });
    }
  }

  return {
    deletedCount: results.filter((result) => result.deleted).length,
    failedCount: results.filter((result) => !result.deleted).length,
    results,
  };
}

export async function reportMessage(userId: string, messageId: string, input: { reason: string; details?: string | null }) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      recipients: {
        select: {
          id: true,
          receiverUserId: true,
        },
      },
    },
  });

  if (!message) {
    throw new AppError("MESSAGE_NOT_FOUND", "메시지를 찾을 수 없어요.", 404);
  }

  const recipient = message.recipients.find((item) => item.receiverUserId === userId);
  const canReport = message.senderId === userId || Boolean(recipient);

  if (!canReport) {
    throw new AppError("MESSAGE_FORBIDDEN", "이 메시지를 신고할 권한이 없어요.", 403);
  }

  const reason = input.reason.trim();

  if (reason.length < 1 || reason.length > 80) {
    throw new AppError("REPORT_REASON_INVALID", "신고 사유를 선택해 주세요.", 400);
  }

  const report = await prisma.messageReport.create({
    data: {
      messageId: message.id,
      messageRecipientId: recipient?.id,
      reporterUserId: userId,
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

export async function archiveReceivedMessage(userId: string, messageId: string) {
  const recipient = await findReceiverRecipient(userId, messageId);

  if (!recipient.receiverArchivedAt) {
    await prisma.messageRecipient.update({
      where: { id: recipient.id },
      data: { receiverArchivedAt: new Date() },
    });
  }

  return { archived: true };
}

export async function unarchiveReceivedMessage(userId: string, messageId: string) {
  const recipient = await findReceiverRecipient(userId, messageId);

  if (recipient.receiverArchivedAt) {
    await prisma.messageRecipient.update({
      where: { id: recipient.id },
      data: { receiverArchivedAt: null },
    });
  }

  return { archived: false };
}

async function findReceiverRecipient(userId: string, messageId: string) {
  const recipient = await prisma.messageRecipient.findFirst({
    where: {
      messageId,
      receiverUserId: userId,
      receiverDeletedAt: null,
      message: {
        status: MessageStatus.SENT,
      },
    },
    select: {
      id: true,
      receiverArchivedAt: true,
    },
  });

  if (!recipient) {
    throw new AppError("MESSAGE_FORBIDDEN", "이 마음을 보관함에서 이동할 권한이 없어요.", 403);
  }

  return recipient;
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

async function getMessageSender(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      nickname: true,
    },
  });

  if (!user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  return user;
}

function normalizeDisplayName(value: string | undefined | null, fallback: string) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized.slice(0, 80) : fallback.slice(0, 80);
}

function getReceiverInputs(input: CreateMessageInput) {
  return input.recipients?.length ? input.recipients : input.receiverInfo ? [input.receiverInfo] : [];
}

function isSenderDeletableStatus(status: MessageStatus) {
  return (
    status === MessageStatus.PENDING ||
    status === MessageStatus.MODERATION_FAILED ||
    status === MessageStatus.CANCELED ||
    status === MessageStatus.SENT ||
    status === MessageStatus.FAILED
  );
}

type NormalizedReceiver = Awaited<ReturnType<typeof normalizeReceiver>>;

async function assertMessageReceiversCommunicationAllowed(senderUserId: string, receivers: NormalizedReceiver[]) {
  const senderTarget = await getUserCommunicationTarget(senderUserId);
  const blockedReceivers = [];

  for (const receiver of receivers) {
    if (receiver.receiverUserId === senderUserId) {
      continue;
    }

    const receiverTarget = await getReceiverCommunicationTarget(receiver);
    const senderBlock = await findCommunicationBlock(
      senderUserId,
      CommunicationBlockDirection.SEND_TO,
      receiverTarget,
    );

    if (senderBlock) {
      blockedReceivers.push({
        receiverName: receiver.receiverName,
        receiverType: receiver.receiverType,
        receiverUserId: receiver.receiverUserId,
        blockedBy: "SENDER_SEND_TO",
        block: getCommunicationBlockDetails(senderBlock),
      });
      continue;
    }

    if (!receiverTarget.userId) {
      continue;
    }

    const receiverBlock = await findCommunicationBlock(
      receiverTarget.userId,
      CommunicationBlockDirection.RECEIVE_FROM,
      senderTarget,
    );

    if (receiverBlock) {
      blockedReceivers.push({
        receiverName: receiver.receiverName,
        receiverType: receiver.receiverType,
        receiverUserId: receiver.receiverUserId,
        blockedBy: "RECEIVER_RECEIVE_FROM",
        block: getCommunicationBlockDetails(receiverBlock),
      });
    }
  }

  if (blockedReceivers.length > 0) {
    throw new AppError("MESSAGE_COMMUNICATION_BLOCKED", "송수신 거부 설정으로 마음을 보낼 수 없어요.", 409, {
      blockedReceivers,
    });
  }
}

async function getReceiverCommunicationTarget(receiver: NormalizedReceiver): Promise<CommunicationTargetReference> {
  const explicitContacts = getContactCommunicationTargets({
    email: receiver.receiverEmail,
    phone: receiver.receiverPhone,
  });

  if (!receiver.receiverUserId) {
    return {
      contacts: explicitContacts,
    };
  }

  return mergeCommunicationTargets(await getUserCommunicationTarget(receiver.receiverUserId), explicitContacts);
}

async function normalizeReceiver(receiverInfo: NonNullable<CreateMessageInput["receiverInfo"]>, userId: string) {
  if (receiverInfo.type === "FRIEND") {
    const friendship = await assertActiveFriendship(userId, receiverInfo.userId ?? "", receiverInfo.friendshipId);

    return {
      receiverUserId: friendship.friend.id,
      receiverType: RecipientType.FRIEND,
      receiverName: friendship.friend.nickname,
      receiverEmail: undefined,
      receiverPhone: undefined,
      receiverInfo: {
        type: "FRIEND",
        friendshipId: friendship.friendshipId,
        userId: friendship.friend.id,
        name: friendship.friend.nickname,
      },
    };
  }

  const receiverType = receiverInfo.type === "SELF" ? RecipientType.SELF : RecipientType.OTHER;
  const receiverName = receiverInfo.type === "SELF" ? "미래의 나" : receiverInfo.name;
  const normalizedEmail = normalizeOptionalEmailContact(receiverInfo.email);
  const normalizedPhone = normalizeOptionalPhoneContact(receiverInfo.phone);
  const linkedUserId =
    receiverInfo.type === "OTHER" && normalizedEmail
      ? await findUserIdByVerifiedEmailContact(normalizedEmail)
      : undefined;

  return {
    receiverUserId: receiverInfo.type === "SELF" ? userId : linkedUserId,
    receiverType,
    receiverName,
    receiverEmail: normalizedEmail ?? undefined,
    receiverPhone: normalizedPhone ?? undefined,
    receiverInfo: {
      type: receiverInfo.type,
      name: receiverName,
      email: normalizedEmail ?? undefined,
      phone: normalizedPhone ?? undefined,
      preferredChannel: receiverInfo.type === "OTHER" ? receiverInfo.preferredChannel ?? "AUTO" : undefined,
      linkedByVerifiedEmail: Boolean(linkedUserId),
    },
  };
}

async function findUserIdByVerifiedEmailContact(normalizedEmail: string) {
  const contact = await prisma.userContact.findUnique({
    where: {
      type_contactHash: {
        type: UserContactType.EMAIL,
        contactHash: hashContact(UserContactType.EMAIL, normalizedEmail),
      },
    },
    select: {
      userId: true,
      verifiedAt: true,
      deletedAt: true,
    },
  });

  return contact?.verifiedAt && !contact.deletedAt ? contact.userId : undefined;
}

function resolveSchedule(input: CreateMessageInput) {
  if (input.arrivalMode === "RANDOM_WINDOW") {
    const start = new Date(input.arrivalWindowStartAt ?? "");
    const end = new Date(input.arrivalWindowEndAt ?? "");
    const scheduledAt = new Date(start.getTime() + Math.floor(Math.random() * (end.getTime() - start.getTime())));

    return {
      scheduledAt,
      arrivalMode: MessageArrivalMode.RANDOM_WINDOW,
      arrivalWindowStartAt: start,
      arrivalWindowEndAt: end,
    };
  }

  return {
    scheduledAt: new Date(input.scheduledAt ?? ""),
    arrivalMode: MessageArrivalMode.FIXED,
    arrivalWindowStartAt: undefined,
    arrivalWindowEndAt: undefined,
  };
}

function createOcrUnavailableResult(results: AttachmentOcrResult[]): ModerationResult {
  const reason = results
    .filter((result) => result.ocrStatus === AttachmentOcrStatus.FAILED)
    .map((result) => result.ocrError)
    .filter(Boolean)
    .join("; ");

  return {
    allowed: "unavailable",
    retryAfter: new Date(Date.now() + 24 * 60 * 60 * 1000),
    reason: reason || "IMAGE_OCR_FAILED",
  };
}

async function persistAttachments(
  messageId: string,
  attachments: NonNullable<CreateMessageInput["attachments"]>,
  ocrResults: AttachmentOcrResult[] = [],
) {
  if (attachments.length > config.maxAttachmentCount) {
    throw new AppError("TOO_MANY_ATTACHMENTS", `이미지는 최대 ${config.maxAttachmentCount}개까지 첨부할 수 있어요.`, 400);
  }

  const decodedAttachments = attachments.map((attachment) => ({
    attachment,
    buffer: decodeAttachment(attachment.dataBase64),
  }));
  const totalBytes = decodedAttachments.reduce((total, item) => total + item.buffer.byteLength, 0);

  if (totalBytes > config.maxAttachmentTotalBytes) {
    throw new AppError("ATTACHMENTS_TOO_LARGE", "첨부 이미지 전체 용량이 너무 커요.", 413);
  }

  for (const item of decodedAttachments) {
    const detectedMimeType = detectSupportedImageMimeType(item.buffer);

    if (detectedMimeType !== item.attachment.mimeType) {
      throw new AppError("ATTACHMENT_TYPE_UNSUPPORTED", "이미지는 jpg, jpeg, png, webp 형식만 첨부할 수 있어요.", 400);
    }

    if (item.buffer.byteLength > config.maxAttachmentBytes) {
      throw new AppError("ATTACHMENT_TOO_LARGE", "첨부 이미지는 허용된 용량보다 작아야 해요.", 413);
    }
  }

  const uploadDir = path.join(config.uploadDir, "messages", messageId);
  await mkdir(uploadDir, { recursive: true });

  return Promise.all(
    decodedAttachments.map(async ({ attachment, buffer }, index) => {
      const extension = extensionForMimeType(attachment.mimeType);
      const fileName = `${String(index + 1).padStart(2, "0")}-${crypto.randomUUID()}${extension}`;
      const storageKey = `messages/${messageId}/${fileName}`;
      await writeFile(path.join(uploadDir, fileName), buffer);
      const ocr = ocrResults[index];

      return {
        storageKey,
        publicUrl: `${config.serviceUrl}${config.uploadPublicPath}/${storageKey}`,
        originalName: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: buffer.byteLength,
        ocrStatus: ocr?.ocrStatus ?? AttachmentOcrStatus.SKIPPED,
        ocrText: ocr?.ocrText ?? null,
        ocrConfidence: ocr?.ocrConfidence ?? null,
        ocrError: ocr?.ocrError ?? null,
        ocrCheckedAt: ocr?.ocrCheckedAt ?? null,
      };
    }),
  );
}

function decodeAttachment(dataBase64: string) {
  const [, base64] = dataBase64.includes(",") ? dataBase64.split(",", 2) : ["", dataBase64];
  return Buffer.from(base64 ?? "", "base64");
}

function extensionForMimeType(mimeType: string) {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return ".bin";
  }
}

function detectSupportedImageMimeType(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}
