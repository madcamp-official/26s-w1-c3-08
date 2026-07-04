import { MessageStatus } from "@maeari/database";
import { domainEvents, MESSAGE_SENT_EVENT } from "../events/domain-events.js";
import { prisma } from "../lib/prisma.js";

export async function sendPendingMessages() {
  const dueMessages = await prisma.message.findMany({
    where: {
      status: MessageStatus.PENDING,
      scheduledAt: {
        lte: new Date(),
      },
    },
    include: {
      recipients: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      scheduledAt: "asc",
    },
    take: 50,
  });

  for (const message of dueMessages) {
    try {
      const sentAt = new Date();
      const recipientIds = message.recipients.map((recipient) => recipient.id);

      await prisma.$transaction(async (tx) => {
        await tx.message.update({
          where: { id: message.id },
          data: {
            status: MessageStatus.SENT,
            sentAt,
          },
        });
      });

      domainEvents.emit(MESSAGE_SENT_EVENT, {
        messageId: message.id,
        recipientIds,
        sentAt,
      });
    } catch (error) {
      await prisma.message.update({
        where: { id: message.id },
        data: {
          status: MessageStatus.FAILED,
          failedAt: new Date(),
          failureReason: error instanceof Error ? error.message : "unknown scheduler error",
        },
      });
    }
  }

  return { processed: dueMessages.length };
}
