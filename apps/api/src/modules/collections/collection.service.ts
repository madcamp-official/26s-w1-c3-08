import {
  MessageCollectionStatus,
  MessageCollectionSubmissionStatus,
  NotificationChannel,
  NotificationEventType,
  NotificationStatus,
  UserContactType,
} from "@maeari/database";
import { config } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import { createPublicToken, createTokenPreview, hashContact, hashPublicToken } from "../../lib/tokens.js";
import { externalNotificationProvider } from "../../processors/notification-provider.js";
import { assertVerifiedSenderPhoneContact } from "../contacts/contact.service.js";
import { getModerationInputHash, moderateMessageWithRetry } from "../moderation/moderation.service.js";
import type {
  CreateMessageCollectionInput,
  CreateMessageCollectionSubmissionInput,
} from "./collection.validation.js";

const PUBLIC_SUBMISSION_LIMIT_PER_HOUR = 5;

export async function createMessageCollection(userId: string, input: CreateMessageCollectionInput) {
  await assertVerifiedSenderPhoneContact(userId);

  const scheduledAt = new Date(input.scheduledAt);

  if (scheduledAt.getTime() <= Date.now()) {
    throw new AppError("COLLECTION_SCHEDULE_INVALID", "마음나무 도착 시점은 현재보다 미래여야 해요.", 400);
  }

  const rawToken = createPublicToken();
  const collection = await prisma.messageCollection.create({
    data: {
      ownerId: userId,
      tokenHash: hashPublicToken(rawToken),
      tokenPreview: createTokenPreview(rawToken),
      title: input.title.trim(),
      description: normalizeDescription(input.description),
      scheduledAt,
    },
  });

  return mapCollection(collection, {
    collectionUrl: toCollectionUrl(rawToken),
    submissionCount: 0,
  });
}

export async function listMessageCollections(userId: string) {
  const collections = await prisma.messageCollection.findMany({
    where: { ownerId: userId },
    include: {
      _count: {
        select: {
          submissions: {
            where: { status: MessageCollectionSubmissionStatus.VISIBLE },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return collections.map((collection) =>
    mapCollection(collection, {
      collectionUrl: null,
      submissionCount: collection._count.submissions,
    }),
  );
}

export async function getMessageCollection(userId: string, collectionId: string) {
  const collection = await prisma.messageCollection.findFirst({
    where: { id: collectionId, ownerId: userId },
    include: {
      submissions: {
        where: {
          status: MessageCollectionSubmissionStatus.VISIBLE,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!collection) {
    throw new AppError("COLLECTION_NOT_FOUND", "마음나무를 찾을 수 없어요.", 404);
  }

  const delivered = collection.status === MessageCollectionStatus.DELIVERED;

  return {
    ...mapCollection(collection, {
      collectionUrl: null,
      submissionCount: collection.submissions.length,
    }),
    submissions: delivered
      ? collection.submissions.map((submission) => ({
          id: submission.id,
          senderDisplayName: submission.senderDisplayName,
          content: submission.content,
          createdAt: submission.createdAt,
          deliveredAt: submission.deliveredAt,
          ownerReadAt: submission.ownerReadAt,
        }))
      : [],
  };
}

export async function cancelMessageCollection(userId: string, collectionId: string) {
  const collection = await prisma.messageCollection.findFirst({
    where: { id: collectionId, ownerId: userId },
  });

  if (!collection) {
    throw new AppError("COLLECTION_NOT_FOUND", "마음나무를 찾을 수 없어요.", 404);
  }

  if (collection.status !== MessageCollectionStatus.ACTIVE) {
    throw new AppError("COLLECTION_NOT_CANCELABLE", "이미 닫힌 마음나무예요.", 409);
  }

  await prisma.messageCollection.update({
    where: { id: collection.id },
    data: {
      status: MessageCollectionStatus.CANCELED,
      canceledAt: new Date(),
    },
  });

  return { canceled: true };
}

export async function getPublicMessageCollection(rawToken: string) {
  const collection = await findPublicCollection(rawToken);

  return {
    id: collection.id,
    title: collection.title,
    description: collection.description,
    scheduledAt: collection.scheduledAt,
    status: collection.status,
    canSubmit: collection.status === MessageCollectionStatus.ACTIVE && collection.scheduledAt.getTime() > Date.now(),
  };
}

export async function createPublicMessageCollectionSubmission(
  rawToken: string,
  input: CreateMessageCollectionSubmissionInput,
  ipAddress: string,
) {
  const collection = await findPublicCollection(rawToken);

  if (collection.status !== MessageCollectionStatus.ACTIVE || collection.scheduledAt.getTime() <= Date.now()) {
    throw new AppError("COLLECTION_CLOSED", "이 마음나무는 더 이상 편지를 받을 수 없어요.", 409);
  }

  const ipHash = hashContact("IP", ipAddress || "unknown");
  const recentCount = await prisma.messageCollectionSubmission.count({
    where: {
      collectionId: collection.id,
      ipHash,
      createdAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000),
      },
    },
  });

  if (recentCount >= PUBLIC_SUBMISSION_LIMIT_PER_HOUR) {
    throw new AppError("COLLECTION_SUBMISSION_RATE_LIMITED", "잠시 후 다시 남겨 주세요.", 429);
  }

  const moderationInput = {
    title: `마음나무: ${collection.title}`,
    content: input.content,
    emotionTag: "collection",
  };
  const moderation = await moderateMessageWithRetry(moderationInput);
  const inputHash = getModerationInputHash(moderationInput);

  if (moderation.allowed === false) {
    throw new AppError("COLLECTION_SUBMISSION_BLOCKED_BY_MODERATION", moderation.feedback, 422, {
      blockedCategories: moderation.blockedCategories,
    });
  }

  if (moderation.allowed === "unavailable") {
    throw new AppError(
      "COLLECTION_SUBMISSION_MODERATION_UNAVAILABLE",
      "지금은 안전 검사를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.",
      503,
    );
  }

  const submission = await prisma.messageCollectionSubmission.create({
    data: {
      collectionId: collection.id,
      senderDisplayName: normalizeDisplayName(input.senderDisplayName),
      content: input.content.trim(),
      status: MessageCollectionSubmissionStatus.VISIBLE,
      moderationInputHash: inputHash,
      moderationCategories: moderation.categories,
      ipHash,
    },
  });

  return {
    submission: {
      id: submission.id,
      createdAt: submission.createdAt,
    },
  };
}

export async function deliverDueMessageCollections() {
  const collections = await prisma.messageCollection.findMany({
    where: {
      status: MessageCollectionStatus.ACTIVE,
      scheduledAt: {
        lte: new Date(),
      },
    },
    include: {
      owner: {
        select: {
          id: true,
          nickname: true,
        },
      },
      submissions: {
        where: { status: MessageCollectionSubmissionStatus.VISIBLE },
      },
    },
    orderBy: { scheduledAt: "asc" },
    take: 50,
  });

  for (const collection of collections) {
    const deliveredAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.messageCollection.update({
        where: { id: collection.id },
        data: {
          status: MessageCollectionStatus.DELIVERED,
          deliveredAt,
        },
      });

      await tx.messageCollectionSubmission.updateMany({
        where: {
          collectionId: collection.id,
          status: MessageCollectionSubmissionStatus.VISIBLE,
        },
        data: { deliveredAt },
      });
    });

    if (collection.submissions.length > 0) {
      await notifyCollectionDelivered(collection.id, collection.owner.id, collection.owner.nickname, collection.title, deliveredAt);
    }
  }

  return { processed: collections.length };
}

async function findPublicCollection(rawToken: string) {
  if (!rawToken) {
    throw new AppError("COLLECTION_TOKEN_REQUIRED", "마음나무 링크 정보를 찾을 수 없어요.", 400);
  }

  const collection = await prisma.messageCollection.findUnique({
    where: { tokenHash: hashPublicToken(rawToken) },
  });

  if (!collection || collection.status === MessageCollectionStatus.CANCELED) {
    throw new AppError("COLLECTION_NOT_FOUND", "마음나무를 찾을 수 없어요.", 404);
  }

  return collection;
}

async function notifyCollectionDelivered(
  collectionId: string,
  ownerId: string,
  ownerName: string,
  title: string,
  deliveredAt: Date,
) {
  const messageUrl = `${config.serviceUrl}/tree`;
  const inAppKey = `${collectionId}:${NotificationEventType.COLLECTION_DELIVERED}:${NotificationChannel.IN_APP}`;

  await prisma.notificationLog.upsert({
    where: { idempotencyKey: inAppKey },
    update: {},
    create: {
      targetUserId: ownerId,
      messageCollectionId: collectionId,
      eventType: NotificationEventType.COLLECTION_DELIVERED,
      channel: NotificationChannel.IN_APP,
      status: NotificationStatus.SENT,
      provider: "in_app",
      idempotencyKey: inAppKey,
      attemptCount: 1,
      attemptedAt: deliveredAt,
      sentAt: deliveredAt,
      scheduledAt: deliveredAt,
      payload: {
        collectionId,
        messageUrl,
        text: "마음나무 편지들이 도착했어요.",
      },
    },
  });

  const emailContact = await prisma.userContact.findFirst({
    where: {
      userId: ownerId,
      type: UserContactType.EMAIL,
      verifiedAt: { not: null },
      deletedAt: null,
    },
    orderBy: [{ isPrimary: "desc" }, { verifiedAt: "desc" }, { createdAt: "asc" }],
  });

  if (!emailContact) {
    return;
  }

  const subject = "매아리 마음나무가 도착했어요";
  const text = [
    `${ownerName}님,`,
    "",
    `"${title}" 마음나무에 모인 편지들이 도착했어요.`,
    "아래 링크에서 로그인 후 확인할 수 있어요.",
    "",
    messageUrl,
    "",
    "알림 이메일에는 편지 내용을 포함하지 않았어요.",
  ].join("\n");
  const html = `<p>${escapeHtml(ownerName)}님,</p><p>${escapeHtml(`"${title}" 마음나무에 모인 편지들이 도착했어요.`)}<br />아래 링크에서 로그인 후 확인할 수 있어요.</p><p><a href="${escapeHtml(messageUrl)}">${escapeHtml(messageUrl)}</a></p><p>알림 이메일에는 편지 내용을 포함하지 않았어요.</p>`;
  const emailKey = `${collectionId}:${NotificationEventType.COLLECTION_DELIVERED}:${NotificationChannel.EMAIL}`;
  const log = await prisma.notificationLog.upsert({
    where: { idempotencyKey: emailKey },
    update: {
      attemptedAt: deliveredAt,
      attemptCount: { increment: 1 },
    },
    create: {
      targetUserId: ownerId,
      messageCollectionId: collectionId,
      eventType: NotificationEventType.COLLECTION_DELIVERED,
      channel: NotificationChannel.EMAIL,
      status: NotificationStatus.PENDING,
      provider: "gmail_smtp",
      idempotencyKey: emailKey,
      attemptCount: 1,
      scheduledAt: deliveredAt,
      attemptedAt: deliveredAt,
      payload: { collectionId, messageUrl, subject, text },
    },
  });

  if (log.status === NotificationStatus.SENT) {
    return;
  }

  const result = await externalNotificationProvider.send({
    channel: "EMAIL",
    to: emailContact.value,
    receiverName: ownerName,
    publicUrl: messageUrl,
    subject,
    text,
    html,
    idempotencyKey: emailKey,
  });

  await prisma.notificationLog.update({
    where: { id: log.id },
    data:
      result.status === "SENT"
        ? {
            status: NotificationStatus.SENT,
            provider: result.provider,
            providerMessageId: result.providerMessageId,
            errorCode: null,
            errorMessage: null,
            sentAt: deliveredAt,
          }
        : {
            status: NotificationStatus.FAILED,
            provider: result.provider,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
          },
  });
}

function mapCollection(
  collection: {
    id: string;
    title: string;
    description: string | null;
    scheduledAt: Date;
    status: MessageCollectionStatus;
    deliveredAt: Date | null;
    createdAt: Date;
  },
  extra: {
    collectionUrl: string | null;
    submissionCount: number;
  },
) {
  return {
    id: collection.id,
    title: collection.title,
    description: collection.description,
    scheduledAt: collection.scheduledAt,
    status: collection.status,
    deliveredAt: collection.deliveredAt,
    createdAt: collection.createdAt,
    submissionCount: extra.submissionCount,
    collectionUrl: extra.collectionUrl,
  };
}

function normalizeDescription(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeDisplayName(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toCollectionUrl(rawToken: string) {
  return `${config.serviceUrl}/tree/${rawToken}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
