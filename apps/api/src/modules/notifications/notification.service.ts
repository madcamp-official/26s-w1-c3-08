import {
  NotificationChannel,
  NotificationEventType,
  NotificationStatus,
  type Prisma,
} from "@maeari/database";
import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function getNotificationSummary(userId: string) {
  return {
    unreadCount: await countUnreadNotifications(userId),
  };
}

export async function listNotifications(userId: string, rawLimit?: unknown) {
  const limit = normalizeLimit(rawLimit);
  const [unreadCount, notifications] = await Promise.all([
    countUnreadNotifications(userId),
    prisma.notificationLog.findMany({
      where: userNotificationWhere(userId),
      include: {
        recipient: {
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
          },
        },
        reply: {
          include: {
            message: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        collection: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  return {
    unreadCount,
    notifications: notifications.map(mapNotification),
  };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const notification = await prisma.notificationLog.findFirst({
    where: {
      id: notificationId,
      ...userNotificationWhere(userId),
    },
    select: {
      id: true,
      readAt: true,
    },
  });

  if (!notification) {
    throw new AppError("NOTIFICATION_NOT_FOUND", "알림을 찾을 수 없어요.", 404);
  }

  const readAt = notification.readAt ?? new Date();

  if (!notification.readAt) {
    await prisma.notificationLog.update({
      where: { id: notification.id },
      data: { readAt },
    });
  }

  return { read: true, readAt };
}

export async function markAllNotificationsRead(userId: string) {
  const readAt = new Date();
  const result = await prisma.notificationLog.updateMany({
    where: {
      ...userNotificationWhere(userId),
      readAt: null,
    },
    data: { readAt },
  });

  return {
    read: true,
    readAt,
    updatedCount: result.count,
  };
}

function countUnreadNotifications(userId: string) {
  return prisma.notificationLog.count({
    where: {
      ...userNotificationWhere(userId),
      readAt: null,
    },
  });
}

function userNotificationWhere(userId: string) {
  return {
    targetUserId: userId,
    channel: NotificationChannel.IN_APP,
    status: NotificationStatus.SENT,
  };
}

function normalizeLimit(rawLimit?: unknown) {
  const value = Number(rawLimit ?? DEFAULT_LIMIT);

  if (!Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(value), 1), MAX_LIMIT);
}

function mapNotification(
  notification: Awaited<ReturnType<typeof prisma.notificationLog.findMany>>[number] & {
    recipient?: {
      message?: {
        id: string;
        title: string;
        senderDisplayName: string | null;
        isSenderHidden: boolean;
        sender: {
          nickname: string;
        };
      };
    } | null;
    reply?: {
      id: string;
      messageId: string;
      message: {
        id: string;
        title: string;
      };
    } | null;
    collection?: {
      id: string;
      title: string;
    } | null;
  },
) {
  const payload = asRecord(notification.payload);
  const fallbackText = typeof payload?.text === "string" ? payload.text : null;
  const message = notification.recipient?.message;
  const senderName = message?.isSenderHidden ? null : message?.senderDisplayName ?? message?.sender.nickname ?? null;

  if (notification.eventType === NotificationEventType.MESSAGE_SENT) {
    return {
      id: notification.id,
      eventType: notification.eventType,
      title: "마음이 도착했어요",
      body: fallbackText ?? (senderName ? `${senderName}님이 보낸 마음이 도착했어요.` : "누군가의 마음이 도착했어요."),
      href: message ? `/messages/${message.id}` : "/inbox",
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }

  if (notification.eventType === NotificationEventType.ARRIVAL_HINT) {
    return {
      id: notification.id,
      eventType: notification.eventType,
      title: "곧 마음이 도착해요",
      body: fallbackText ?? "예약된 마음이 곧 도착할 예정이에요.",
      href: "/inbox",
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }

  if (notification.eventType === NotificationEventType.REPLY_RECEIVED) {
    const replyMessage = notification.reply?.message;

    return {
      id: notification.id,
      eventType: notification.eventType,
      title: "답장이 도착했어요",
      body: fallbackText ?? (replyMessage ? `"${replyMessage.title}"에 답장이 도착했어요.` : "보낸 마음에 답장이 도착했어요."),
      href: replyMessage ? `/messages/${replyMessage.id}` : "/sent",
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }

  if (notification.eventType === NotificationEventType.COLLECTION_DELIVERED) {
    return {
      id: notification.id,
      eventType: notification.eventType,
      title: "마음나무가 도착했어요",
      body: fallbackText ?? (notification.collection ? `"${notification.collection.title}" 마음나무가 도착했어요.` : "마음나무 편지들이 도착했어요."),
      href: "/tree",
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }

  return {
    id: notification.id,
    eventType: notification.eventType,
    title: "매아리 알림",
    body: fallbackText ?? "새 알림이 있어요.",
    href: "/",
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}

function asRecord(value?: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : null;
}
