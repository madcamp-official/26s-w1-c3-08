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
      },
    });

    for (const recipient of recipients) {
      if (!recipient.receiverUserId) {
        await prisma.notificationLog.create({
          data: {
            messageRecipientId: recipient.id,
            eventType: NotificationEventType.MESSAGE_SENT,
            channel: NotificationChannel.IN_APP,
            status: NotificationStatus.SKIPPED,
            attemptedAt: new Date(),
            errorMessage: "가입 수신자가 아니어서 내부 알림을 생성하지 않았습니다.",
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
