import { NotificationChannel, NotificationEventType, NotificationStatus } from "@maeum-arrival/database";
import { prisma } from "../lib/prisma.js";
import type { MessageSentEventPayload } from "../events/domain-events.js";

export class NotificationProcessor {
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
        accessTokens: {
          where: {
            revokedAt: null,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            id: true,
            tokenPreview: true,
          },
        },
      },
    });

    for (const recipient of recipients) {
      if (!recipient.receiverUserId) {
        const channel = recipient.receiverEmail
          ? NotificationChannel.EMAIL
          : recipient.receiverPhone
            ? NotificationChannel.SMS
            : NotificationChannel.IN_APP;

        await prisma.notificationLog.create({
          data: {
            messageRecipientId: recipient.id,
            eventType: NotificationEventType.MESSAGE_SENT,
            channel,
            status: NotificationStatus.SKIPPED,
            attemptedAt: new Date(),
            payload: {
              messageId: payload.messageId,
              sentAt: payload.sentAt.toISOString(),
              receiverName: recipient.receiverName,
              receiverEmail: recipient.receiverEmail,
              receiverPhone: recipient.receiverPhone,
              accessTokenId: recipient.accessTokens[0]?.id ?? null,
              tokenPreview: recipient.accessTokens[0]?.tokenPreview ?? null,
            },
            errorMessage: "외부 알림 provider가 설정되지 않아 실제 발송은 생략했습니다.",
          },
        });
        continue;
      }

      await prisma.notificationLog.create({
        data: {
          messageRecipientId: recipient.id,
          eventType: NotificationEventType.MESSAGE_SENT,
          channel: NotificationChannel.IN_APP,
          status: NotificationStatus.SENT,
          attemptedAt: new Date(),
          sentAt: new Date(),
          payload: {
            messageId: payload.messageId,
            sentAt: payload.sentAt.toISOString(),
          },
        },
      });
    }
  }
}

export const notificationProcessor = new NotificationProcessor();
