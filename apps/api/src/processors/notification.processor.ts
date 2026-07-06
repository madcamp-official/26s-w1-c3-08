import {
  NotificationChannel,
  NotificationEventType,
  NotificationStatus,
  RecipientDeliveryStatus,
  type NotificationLog,
  type MessageRecipient,
  type Prisma,
} from "@maeari/database";
import { config } from "../config/env.js";
import type { MessageSentEventPayload } from "../events/domain-events.js";
import { normalizeEmailContact, normalizePhoneContact } from "../lib/contact-normalization.js";
import { prisma } from "../lib/prisma.js";
import { createPublicToken, createTokenPreview, hashContact, hashPublicToken } from "../lib/tokens.js";
import { toPublicUrl } from "../modules/messages/message.mapper.js";
import {
  externalNotificationProvider,
  type ExternalNotificationChannel,
  type SendNotificationResult,
} from "./notification-provider.js";

type ExternalRecipient = Pick<
  MessageRecipient,
  "id" | "receiverUserId" | "receiverEmail" | "receiverPhone" | "receiverName" | "receiverInfo"
> & {
  message?: {
    isSenderHidden: boolean;
    sender: {
      nickname: string;
    };
  };
};

const RETRY_DELAYS_MS = [60 * 1000, 5 * 60 * 1000, 30 * 60 * 1000];

export class NotificationProcessor {
  async sendArrivalHints() {
    const messages = await prisma.message.findMany({
      where: {
        status: "PENDING",
        hintAt: {
          lte: new Date(),
        },
        hintSentAt: null,
      },
      include: {
        recipients: {
          include: {
            message: {
              select: {
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
      },
      orderBy: { hintAt: "asc" },
      take: 50,
    });

    for (const message of messages) {
      const hintedAt = new Date();

      for (const recipient of message.recipients) {
        if (recipient.receiverUserId) {
          await this.createInAppHintNotification(recipient.id, message.id, hintedAt);
          continue;
        }

        await this.deliverExternalHint(recipient, hintedAt);
      }

      await prisma.message.update({
        where: { id: message.id },
        data: { hintSentAt: hintedAt },
      });
    }

    return { processed: messages.length };
  }

  async handleMessageSent(payload: MessageSentEventPayload) {
    const recipients = await prisma.messageRecipient.findMany({
      where: {
        id: {
          in: payload.recipientIds,
        },
      },
      select: {
        id: true,
        receiverUserId: true,
        receiverEmail: true,
        receiverPhone: true,
        receiverName: true,
        receiverInfo: true,
        message: {
          select: {
            isSenderHidden: true,
            sender: {
              select: {
                nickname: true,
              },
            },
          },
        },
      },
    });

    for (const recipient of recipients) {
      if (recipient.receiverUserId) {
        await this.createInAppNotification(recipient.id, payload);
        continue;
      }

      await this.deliverExternalRecipient(recipient, payload.sentAt);
    }
  }

  async retryPendingNotifications() {
    const logs = await prisma.notificationLog.findMany({
      where: {
        eventType: NotificationEventType.MESSAGE_SENT,
        status: NotificationStatus.PENDING,
        nextRetryAt: {
          lte: new Date(),
        },
        channel: {
          in: [NotificationChannel.SMS, NotificationChannel.EMAIL],
        },
      },
      include: {
        recipient: {
          include: {
            message: {
              select: {
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
      },
      orderBy: { nextRetryAt: "asc" },
      take: 50,
    });

    for (const log of logs) {
      await this.deliverExternalRecipient(log.recipient, log.scheduledAt ?? new Date(), log);
    }

    return { processed: logs.length };
  }

  private async createInAppNotification(recipientId: string, payload: MessageSentEventPayload) {
    const idempotencyKey = createIdempotencyKey(recipientId, NotificationEventType.MESSAGE_SENT, NotificationChannel.IN_APP);

    await prisma.$transaction(async (tx) => {
      await tx.notificationLog.upsert({
        where: { idempotencyKey },
        update: {},
        create: {
          messageRecipientId: recipientId,
          eventType: NotificationEventType.MESSAGE_SENT,
          channel: NotificationChannel.IN_APP,
          status: NotificationStatus.SENT,
          provider: "in_app",
          idempotencyKey,
          attemptCount: 1,
          attemptedAt: new Date(),
          sentAt: payload.sentAt,
          scheduledAt: payload.sentAt,
          payload: {
            messageId: payload.messageId,
            sentAt: payload.sentAt.toISOString(),
          },
        },
      });

      await tx.messageRecipient.update({
        where: { id: recipientId },
        data: {
          deliveryStatus: RecipientDeliveryStatus.SENT,
          deliveredAt: payload.sentAt,
        },
      });
    });
  }

  private async createInAppHintNotification(recipientId: string, messageId: string, hintedAt: Date) {
    const idempotencyKey = createIdempotencyKey(recipientId, NotificationEventType.ARRIVAL_HINT, NotificationChannel.IN_APP);

    await prisma.notificationLog.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        messageRecipientId: recipientId,
        eventType: NotificationEventType.ARRIVAL_HINT,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.SENT,
        provider: "in_app",
        idempotencyKey,
        attemptCount: 1,
        attemptedAt: hintedAt,
        sentAt: hintedAt,
        scheduledAt: hintedAt,
        payload: {
          messageId,
          hintedAt: hintedAt.toISOString(),
          text: "곧 마음이 도착할 예정이에요.",
        },
      },
    });
  }

  private async deliverExternalRecipient(
    recipient: ExternalRecipient,
    sentAt: Date,
    existingLog?: NotificationLog,
    forcedChannel?: ExternalNotificationChannel,
  ) {
    const channel = forcedChannel ?? existingLog?.channel ?? chooseChannel(recipient);
    const contact = channel === NotificationChannel.SMS ? recipient.receiverPhone : recipient.receiverEmail;

    if (!contact || (channel !== NotificationChannel.SMS && channel !== NotificationChannel.EMAIL)) {
      await this.markExternalSkipped(recipient, channel, sentAt, "INVALID_RECEIVER_CONTACT", "수신자 연락처를 확인하지 못했어요.");
      return;
    }

    const normalizedContact = normalizeContactForChannel(channel, contact);

    if (!normalizedContact) {
      await this.markExternalSkipped(recipient, channel, sentAt, "INVALID_RECEIVER_CONTACT", "수신자 연락처 형식을 확인하지 못했어요.");
      return;
    }

    const idempotencyKey =
      existingLog?.idempotencyKey ?? createIdempotencyKey(recipient.id, NotificationEventType.MESSAGE_SENT, channel);
    const log = existingLog ?? (await prisma.notificationLog.findUnique({ where: { idempotencyKey } }));

    if (log?.status === NotificationStatus.SENT) {
      await prisma.messageRecipient.update({
        where: { id: recipient.id },
        data: {
          deliveryStatus: RecipientDeliveryStatus.SENT,
          deliveredAt: log.sentAt ?? sentAt,
        },
      });
      return;
    }

    if (await isContactSuppressed(channel, normalizedContact)) {
      await this.markExternalSkipped(
        recipient,
        channel,
        sentAt,
        "CONTACT_SUPPRESSED",
        channel === NotificationChannel.SMS
          ? "수신자가 문자 알림 수신을 거부했어요."
          : "수신자가 이메일 알림 수신을 거부했어요.",
      );
      return;
    }

    const publicUrl = extractPublicUrl(log?.payload) ?? (await createRecipientPublicUrl(recipient.id));
    const content = createNotificationContent(recipient, channel, publicUrl);
    const payload = createExternalPayload(recipient, sentAt, publicUrl, content);
    const savedLog = log
      ? await prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            payload,
            attemptedAt: new Date(),
            attemptCount: { increment: 1 },
            errorCode: null,
            errorMessage: null,
          },
        })
      : await prisma.notificationLog.create({
          data: {
            messageRecipientId: recipient.id,
            eventType: NotificationEventType.MESSAGE_SENT,
            channel,
            status: NotificationStatus.PENDING,
            provider: providerForChannel(channel),
            idempotencyKey,
            attemptCount: 1,
            scheduledAt: sentAt,
            attemptedAt: new Date(),
            payload,
          },
        });

    const result = await externalNotificationProvider.send({
      channel: channel as ExternalNotificationChannel,
      to: normalizedContact,
      receiverName: recipient.receiverName,
      publicUrl,
      subject: content.subject,
      text: content.text,
      html: content.html,
      idempotencyKey,
    });

    await this.applyExternalResult(recipient, savedLog, sentAt, result);
  }

  private async deliverExternalHint(recipient: ExternalRecipient, hintedAt: Date) {
    const channel = chooseChannel(recipient);
    const contact = channel === NotificationChannel.SMS ? recipient.receiverPhone : recipient.receiverEmail;

    if (!contact || (channel !== NotificationChannel.SMS && channel !== NotificationChannel.EMAIL)) {
      await this.markHintSkipped(recipient, channel, hintedAt, "INVALID_RECEIVER_CONTACT", "수신자 연락처를 확인하지 못했어요.");
      return;
    }

    const normalizedContact = normalizeContactForChannel(channel, contact);

    if (!normalizedContact) {
      await this.markHintSkipped(recipient, channel, hintedAt, "INVALID_RECEIVER_CONTACT", "수신자 연락처 형식을 확인하지 못했어요.");
      return;
    }

    const idempotencyKey = createIdempotencyKey(recipient.id, NotificationEventType.ARRIVAL_HINT, channel);
    const existingLog = await prisma.notificationLog.findUnique({ where: { idempotencyKey } });

    if (existingLog?.status === NotificationStatus.SENT) {
      return;
    }

    if (await isContactSuppressed(channel, normalizedContact)) {
      await this.markHintSkipped(
        recipient,
        channel,
        hintedAt,
        "CONTACT_SUPPRESSED",
        channel === NotificationChannel.SMS
          ? "수신자가 문자 알림 수신을 거부했어요."
          : "수신자가 이메일 알림 수신을 거부했어요.",
      );
      return;
    }

    const publicUrl = await createRecipientPublicUrl(recipient.id);
    const content = createHintNotificationContent(recipient, channel, publicUrl);
    const payload = createExternalPayload(recipient, hintedAt, publicUrl, content);
    const log = existingLog
      ? await prisma.notificationLog.update({
          where: { id: existingLog.id },
          data: {
            payload,
            attemptedAt: hintedAt,
            attemptCount: { increment: 1 },
            errorCode: null,
            errorMessage: null,
          },
        })
      : await prisma.notificationLog.create({
          data: {
            messageRecipientId: recipient.id,
            eventType: NotificationEventType.ARRIVAL_HINT,
            channel,
            status: NotificationStatus.PENDING,
            provider: providerForChannel(channel),
            idempotencyKey,
            attemptCount: 1,
            scheduledAt: hintedAt,
            attemptedAt: hintedAt,
            payload,
          },
        });

    const result = await externalNotificationProvider.send({
      channel: channel as ExternalNotificationChannel,
      to: normalizedContact,
      receiverName: recipient.receiverName,
      publicUrl,
      subject: content.subject,
      text: content.text,
      html: content.html,
      idempotencyKey,
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
              nextRetryAt: null,
              sentAt: hintedAt,
            }
          : {
              status:
                result.errorCode === "NOTIFICATION_PROVIDER_NOT_CONFIGURED"
                  ? NotificationStatus.SKIPPED
                  : NotificationStatus.FAILED,
              provider: result.provider,
              errorCode: result.errorCode,
              errorMessage: result.errorMessage,
              nextRetryAt: null,
            },
    });
  }

  private async applyExternalResult(
    recipient: ExternalRecipient,
    log: NotificationLog,
    sentAt: Date,
    result: SendNotificationResult,
  ) {
    if (result.status === "SENT") {
      await prisma.$transaction(async (tx) => {
        await tx.notificationLog.update({
          where: { id: log.id },
          data: {
            status: NotificationStatus.SENT,
            provider: result.provider,
            providerMessageId: result.providerMessageId,
            errorCode: null,
            errorMessage: null,
            nextRetryAt: null,
            sentAt,
          },
        });

        await tx.messageRecipient.update({
          where: { id: recipient.id },
          data: {
            deliveryStatus: RecipientDeliveryStatus.SENT,
            deliveredAt: sentAt,
          },
        });
      });
      return;
    }

    if (result.status === "RETRYABLE_FAILED" && log.attemptCount < config.notificationMaxAttempts) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: NotificationStatus.PENDING,
          provider: result.provider,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          nextRetryAt: nextRetryAt(log.attemptCount),
        },
      });
      return;
    }

    const status =
      result.errorCode === "NOTIFICATION_PROVIDER_NOT_CONFIGURED"
        ? NotificationStatus.SKIPPED
        : NotificationStatus.FAILED;

    await prisma.$transaction(async (tx) => {
      await tx.notificationLog.update({
        where: { id: log.id },
        data: {
          status,
          provider: result.provider,
          errorCode: result.errorCode ?? "DELIVERY_RETRY_EXHAUSTED",
          errorMessage: result.errorMessage,
          nextRetryAt: null,
        },
      });

      await tx.messageRecipient.update({
        where: { id: recipient.id },
        data: {
          deliveryStatus: RecipientDeliveryStatus.FAILED,
          deliveredAt: null,
        },
      });
    });

  }

  private async markExternalSkipped(
    recipient: ExternalRecipient,
    channel: NotificationChannel,
    sentAt: Date,
    errorCode: string,
    errorMessage: string,
  ) {
    const idempotencyKey = createIdempotencyKey(recipient.id, NotificationEventType.MESSAGE_SENT, channel);

    await prisma.$transaction(async (tx) => {
      await tx.notificationLog.upsert({
        where: { idempotencyKey },
        update: {
          status: NotificationStatus.SKIPPED,
          provider: errorCode === "CONTACT_SUPPRESSED" ? "contact_suppression" : providerForChannel(channel),
          attemptedAt: new Date(),
          nextRetryAt: null,
          errorCode,
          errorMessage,
        },
        create: {
          messageRecipientId: recipient.id,
          eventType: NotificationEventType.MESSAGE_SENT,
          channel,
          status: NotificationStatus.SKIPPED,
          provider: errorCode === "CONTACT_SUPPRESSED" ? "contact_suppression" : providerForChannel(channel),
          idempotencyKey,
          attemptCount: 1,
          scheduledAt: sentAt,
          attemptedAt: new Date(),
          payload: createExternalPayload(recipient, sentAt, null, null),
          errorCode,
          errorMessage,
        },
      });

      await tx.messageRecipient.update({
        where: { id: recipient.id },
        data: {
          deliveryStatus: RecipientDeliveryStatus.FAILED,
          deliveredAt: null,
        },
      });
    });
  }

  private async markHintSkipped(
    recipient: ExternalRecipient,
    channel: NotificationChannel,
    hintedAt: Date,
    errorCode: string,
    errorMessage: string,
  ) {
    const idempotencyKey = createIdempotencyKey(recipient.id, NotificationEventType.ARRIVAL_HINT, channel);

    await prisma.notificationLog.upsert({
      where: { idempotencyKey },
      update: {
        status: NotificationStatus.SKIPPED,
        provider: errorCode === "CONTACT_SUPPRESSED" ? "contact_suppression" : providerForChannel(channel),
        attemptedAt: hintedAt,
        nextRetryAt: null,
        errorCode,
        errorMessage,
      },
      create: {
        messageRecipientId: recipient.id,
        eventType: NotificationEventType.ARRIVAL_HINT,
        channel,
        status: NotificationStatus.SKIPPED,
        provider: errorCode === "CONTACT_SUPPRESSED" ? "contact_suppression" : providerForChannel(channel),
        idempotencyKey,
        attemptCount: 1,
        scheduledAt: hintedAt,
        attemptedAt: hintedAt,
        payload: createExternalPayload(recipient, hintedAt, null, null),
        errorCode,
        errorMessage,
      },
    });
  }
}

async function createRecipientPublicUrl(messageRecipientId: string) {
  const rawToken = createPublicToken();

  await prisma.messageAccessToken.create({
    data: {
      messageRecipientId,
      tokenHash: hashPublicToken(rawToken),
      tokenPreview: createTokenPreview(rawToken),
    },
  });

  return toPublicUrl(rawToken) ?? "";
}

function chooseChannel(recipient: ExternalRecipient) {
  const receiverInfo = asRecord(recipient.receiverInfo);
  const preferredChannel = receiverInfo?.preferredChannel;

  if (preferredChannel === "EMAIL") {
    return NotificationChannel.EMAIL;
  }

  if (preferredChannel === "SMS") {
    return NotificationChannel.SMS;
  }

  return recipient.receiverEmail ? NotificationChannel.EMAIL : NotificationChannel.SMS;
}

type NotificationContent = {
  subject?: string;
  text: string;
  html?: string;
};

function createNotificationContent(
  recipient: ExternalRecipient,
  channel: NotificationChannel,
  publicUrl: string,
): NotificationContent {
  const receiverName = recipient.receiverName?.trim() || "받는 분";
  const senderName = recipient.message?.isSenderHidden ? null : recipient.message?.sender.nickname ?? null;
  const arrivalLine = senderName
    ? `${senderName}님이 보낸 마음이 도착했어요.`
    : "누군가의 마음이 도착했어요.";

  if (channel === NotificationChannel.SMS) {
    const text = senderName
      ? `[매아리] ${senderName}님이 보낸 마음이 도착했습니다. 아래 링크에서 확인해 보세요!\n${publicUrl}`
      : `[매아리] 과거에서 당신을 위한 마음이 도착했습니다. 아래 링크에서 확인해 보세요!\n${publicUrl}`;

    return {
      text,
    };
  }

  const subject = "매아리에서 마음이 도착했어요";
  const text = [
    `${receiverName}님,`,
    "",
    arrivalLine,
    "아래 링크에서 도착한 마음을 열어볼 수 있어요.",
    "",
    publicUrl,
    "",
    "이 이메일은 발신자가 입력한 연락처로 발송된 예약 메시지 도착 알림입니다.",
    "편지 내용은 이메일에 포함하지 않았어요.",
    "열람 링크에서 이메일 알림을 다시 받지 않도록 설정할 수 있어요.",
  ].join("\n");
  const html = [
    "<p>",
    escapeHtml(`${receiverName}님,`),
    "</p>",
    "<p>",
    escapeHtml(arrivalLine),
    "<br />아래 링크에서 도착한 마음을 열어볼 수 있어요.</p>",
    `<p><a href="${escapeHtml(publicUrl)}">${escapeHtml(publicUrl)}</a></p>`,
    "<p>이 이메일은 발신자가 입력한 연락처로 발송된 예약 메시지 도착 알림입니다.<br />",
    "편지 내용은 이메일에 포함하지 않았어요.<br />",
    "열람 링크에서 이메일 알림을 다시 받지 않도록 설정할 수 있어요.</p>",
  ].join("");

  return { subject, text, html };
}

function createHintNotificationContent(
  recipient: ExternalRecipient,
  channel: NotificationChannel,
  publicUrl: string,
): NotificationContent {
  const receiverName = recipient.receiverName?.trim() || "받는 분";
  const senderName = recipient.message?.isSenderHidden ? null : recipient.message?.sender.nickname ?? null;
  const hintLine = senderName
    ? `${senderName}님이 맡긴 마음이 곧 도착할 예정이에요.`
    : "당신을 위한 마음이 곧 도착할 예정이에요.";

  if (channel === NotificationChannel.SMS) {
    return {
      text: `[매아리] ${hintLine}\n도착 시간이 지나면 아래 링크에서 확인할 수 있어요.\n${publicUrl}`,
    };
  }

  const subject = "매아리에서 곧 마음이 도착해요";
  const text = [
    `${receiverName}님,`,
    "",
    hintLine,
    "도착 시간이 지나면 아래 링크에서 열어볼 수 있어요.",
    "",
    publicUrl,
    "",
    "편지 내용은 이메일에 포함하지 않았어요.",
  ].join("\n");
  const html = [
    "<p>",
    escapeHtml(`${receiverName}님,`),
    "</p>",
    "<p>",
    escapeHtml(hintLine),
    "<br />도착 시간이 지나면 아래 링크에서 열어볼 수 있어요.</p>",
    `<p><a href="${escapeHtml(publicUrl)}">${escapeHtml(publicUrl)}</a></p>`,
    "<p>편지 내용은 이메일에 포함하지 않았어요.</p>",
  ].join("");

  return { subject, text, html };
}

function createExternalPayload(
  recipient: ExternalRecipient,
  sentAt: Date,
  publicUrl: string | null,
  content: NotificationContent | null,
) {
  return {
    sentAt: sentAt.toISOString(),
    receiverName: recipient.receiverName,
    receiverEmail: recipient.receiverEmail,
    receiverPhone: recipient.receiverPhone,
    publicUrl,
    subject: content?.subject ?? null,
    text: content?.text ?? null,
  };
}

function createIdempotencyKey(recipientId: string, eventType: NotificationEventType, channel: NotificationChannel) {
  return `${recipientId}:${eventType}:${channel}`;
}

function providerForChannel(channel: NotificationChannel) {
  if (channel === NotificationChannel.EMAIL && config.gmailSmtpEnabled) {
    return "gmail_smtp";
  }

  if (channel === NotificationChannel.SMS && config.solapiSmsEnabled) {
    return "solapi";
  }

  return "mcp";
}

async function isContactSuppressed(channel: NotificationChannel, normalizedContact: string) {
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

function normalizeContactForChannel(channel: NotificationChannel, contact: string) {
  if (channel === NotificationChannel.EMAIL) {
    return normalizeEmailContact(contact);
  }

  if (channel === NotificationChannel.SMS) {
    return normalizePhoneContact(contact);
  }

  return null;
}

function extractPublicUrl(payload?: Prisma.JsonValue | null) {
  const value = asRecord(payload)?.publicUrl;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asRecord(value?: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : null;
}

function nextRetryAt(attemptCount: number) {
  const delay = RETRY_DELAYS_MS[Math.min(attemptCount - 1, RETRY_DELAYS_MS.length - 1)] ?? RETRY_DELAYS_MS[0] ?? 60000;
  return new Date(Date.now() + delay);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const notificationProcessor = new NotificationProcessor();
