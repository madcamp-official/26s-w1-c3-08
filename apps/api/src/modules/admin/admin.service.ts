import { MessageReplyStatus, NotificationStatus } from "@maeari/database";
import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";

export async function getAdminOverview() {
  const now = new Date();
  const [
    users,
    messages,
    pendingMessages,
    failedModerationMessages,
    blockedMessages,
    pendingNotifications,
    failedNotifications,
    visibleReplies,
    pendingReports,
    notificationTotal,
    dueNotificationRetries,
    scheduledNotificationRetries,
    notificationStatusRows,
    notificationChannelRows,
    notificationProviderRows,
    notificationFailureRows,
    recipientDeliveryRows,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.message.count(),
    prisma.message.count({ where: { status: "PENDING" } }),
    prisma.message.count({ where: { status: "MODERATION_FAILED" } }),
    prisma.message.count({ where: { status: "BLOCKED" } }),
    prisma.notificationLog.count({ where: { status: NotificationStatus.PENDING } }),
    prisma.notificationLog.count({ where: { status: NotificationStatus.FAILED } }),
    prisma.messageReply.count({ where: { status: MessageReplyStatus.VISIBLE } }),
    prisma.messageReport.count({ where: { status: "PENDING" } }),
    prisma.notificationLog.count(),
    prisma.notificationLog.count({
      where: {
        status: NotificationStatus.PENDING,
        nextRetryAt: {
          lte: now,
        },
      },
    }),
    prisma.notificationLog.count({
      where: {
        status: NotificationStatus.PENDING,
        nextRetryAt: {
          not: null,
          gt: now,
        },
      },
    }),
    prisma.notificationLog.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
    }),
    prisma.notificationLog.groupBy({
      by: ["channel", "status"],
      _count: {
        _all: true,
      },
      orderBy: [{ channel: "asc" }, { status: "asc" }],
    }),
    prisma.notificationLog.groupBy({
      by: ["provider", "status"],
      _count: {
        _all: true,
      },
      orderBy: [{ provider: "asc" }, { status: "asc" }],
    }),
    prisma.notificationLog.groupBy({
      by: ["errorCode"],
      where: {
        errorCode: {
          not: null,
        },
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _count: {
          errorCode: "desc",
        },
      },
      take: 8,
    }),
    prisma.messageRecipient.groupBy({
      by: ["deliveryStatus"],
      _count: {
        _all: true,
      },
      orderBy: {
        deliveryStatus: "asc",
      },
    }),
  ]);

  return {
    users,
    messages,
    pendingMessages,
    failedModerationMessages,
    blockedMessages,
    pendingNotifications,
    failedNotifications,
    visibleReplies,
    pendingReports,
    notificationStats: {
      total: notificationTotal,
      dueRetries: dueNotificationRetries,
      scheduledRetries: scheduledNotificationRetries,
      byStatus: notificationStatusRows.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      byChannel: notificationChannelRows.map((row) => ({
        channel: row.channel,
        status: row.status,
        count: row._count._all,
      })),
      byProvider: notificationProviderRows.map((row) => ({
        provider: row.provider ?? "none",
        status: row.status,
        count: row._count._all,
      })),
      failureCodes: notificationFailureRows.map((row) => ({
        errorCode: row.errorCode ?? "UNKNOWN",
        count: row._count._all,
      })),
    },
    recipientDeliveryStats: recipientDeliveryRows.map((row) => ({
      status: row.deliveryStatus,
      count: row._count._all,
    })),
  };
}

export async function listAdminModerationLogs() {
  const logs = await prisma.moderationLog.findMany({
    orderBy: { checkedAt: "desc" },
    take: 80,
    include: {
      message: {
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          sender: {
            select: {
              id: true,
              nickname: true,
            },
          },
        },
      },
    },
  });

  return logs.map((log) => ({
    id: log.id,
    messageId: log.messageId,
    attemptNo: log.attemptNo,
    provider: log.provider,
    model: log.model,
    status: log.status,
    categories: log.categories,
    feedback: log.feedback,
    errorCode: log.errorCode,
    errorMessage: log.errorMessage,
    checkedAt: log.checkedAt,
    message: {
      id: log.message.id,
      title: log.message.title,
      status: log.message.status,
      senderName: log.message.sender.nickname,
      createdAt: log.message.createdAt,
    },
  }));
}

export async function listAdminNotificationLogs() {
  const logs = await prisma.notificationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      recipient: {
        select: {
          id: true,
          receiverType: true,
          receiverName: true,
          receiverEmail: true,
          receiverPhone: true,
          message: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      },
    },
  });

  return logs.map((log) => ({
    id: log.id,
    messageRecipientId: log.messageRecipientId,
    eventType: log.eventType,
    channel: log.channel,
    status: log.status,
    provider: log.provider,
    attemptCount: log.attemptCount,
    providerMessageId: log.providerMessageId,
    errorCode: log.errorCode,
    errorMessage: log.errorMessage,
    scheduledAt: log.scheduledAt,
    attemptedAt: log.attemptedAt,
    sentAt: log.sentAt,
    createdAt: log.createdAt,
    recipient: log.recipient
      ? {
          id: log.recipient.id,
          type: log.recipient.receiverType,
          name: log.recipient.receiverName,
          contactMasked: maskContact(log.recipient.receiverEmail ?? log.recipient.receiverPhone),
          messageId: log.recipient.message.id,
          messageTitle: log.recipient.message.title,
          messageStatus: log.recipient.message.status,
        }
      : null,
  }));
}

export async function listAdminReplies() {
  const replies = await prisma.messageReply.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      message: {
        select: {
          id: true,
          title: true,
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
  });

  return replies.map((reply) => ({
    id: reply.id,
    messageId: reply.messageId,
    status: reply.status,
    contentPreview: reply.content.slice(0, 120),
    isAnonymous: reply.isAnonymous,
    senderDisplayName: reply.isAnonymous ? null : reply.senderDisplayName,
    hiddenReason: reply.hiddenReason,
    createdAt: reply.createdAt,
    message: {
      id: reply.message.id,
      title: reply.message.title,
      senderName: reply.message.sender.nickname,
      recipientName: reply.recipient.receiverName,
      recipientType: reply.recipient.receiverType,
    },
  }));
}

export async function listAdminReports() {
  const reports = await prisma.messageReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      message: {
        select: {
          id: true,
          title: true,
          status: true,
          sender: {
            select: {
              id: true,
              nickname: true,
              kakaoId: true,
              suspendedAt: true,
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
      reporter: {
        select: {
          id: true,
          nickname: true,
        },
      },
    },
  });

  return reports.map((report) => ({
    id: report.id,
    messageId: report.messageId,
    reason: report.reason,
    details: report.details,
    status: report.status,
    reviewedAt: report.reviewedAt,
    reviewNote: report.reviewNote,
    createdAt: report.createdAt,
    reporterName: report.reporter?.nickname ?? "비회원/공개 링크",
    message: {
      id: report.message.id,
      title: report.message.title,
      status: report.message.status,
      senderId: report.message.sender.id,
      senderName: report.message.sender.nickname,
      senderSuspendedAt: report.message.sender.suspendedAt,
      recipientName: report.recipient?.receiverName,
      recipientType: report.recipient?.receiverType,
    },
  }));
}

export async function reviewAdminReport(reportId: string, input: { status: "REVIEWED" | "DISMISSED"; note?: string | null }) {
  const report = await prisma.messageReport.findUnique({
    where: { id: reportId },
    select: { id: true },
  });

  if (!report) {
    throw new AppError("REPORT_NOT_FOUND", "신고를 찾을 수 없어요.", 404);
  }

  await prisma.messageReport.update({
    where: { id: report.id },
    data: {
      status: input.status,
      reviewedAt: new Date(),
      reviewNote: input.note?.trim() || null,
    },
  });

  return { reviewed: true };
}

export async function suspendAdminUser(userId: string, reason?: string | null) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      suspendedAt: new Date(),
      suspensionReason: reason?.trim() || "관리자에 의한 이용 제한",
    },
  });

  return { suspended: true };
}

export async function unsuspendAdminUser(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      suspendedAt: null,
      suspensionReason: null,
    },
  });

  return { suspended: false };
}

export async function hideAdminReply(replyId: string, reason?: string) {
  const reply = await prisma.messageReply.findUnique({
    where: { id: replyId },
    select: { id: true },
  });

  if (!reply) {
    throw new AppError("REPLY_NOT_FOUND", "답장을 찾을 수 없어요.", 404);
  }

  await prisma.messageReply.update({
    where: { id: reply.id },
    data: {
      status: MessageReplyStatus.HIDDEN,
      hiddenAt: new Date(),
      hiddenReason: reason?.trim() || "관리자 검수 숨김",
    },
  });

  return { hidden: true };
}

function maskContact(contact?: string | null) {
  if (!contact) {
    return null;
  }

  if (contact.includes("@")) {
    const [name, domain] = contact.split("@");
    return `${(name ?? "").slice(0, 2)}***@${domain ?? ""}`;
  }

  return `${contact.slice(0, 3)}****${contact.slice(-4)}`;
}
