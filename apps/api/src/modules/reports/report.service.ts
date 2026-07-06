import { prisma } from "../../lib/prisma.js";

export async function getEmotionReport(userId: string, month?: string) {
  const range = resolveMonthRange(month);

  const [sentMessages, receivedRecipients] = await Promise.all([
    prisma.message.findMany({
      where: {
        senderId: userId,
        senderDeletedAt: null,
        createdAt: {
          gte: range.start,
          lt: range.end,
        },
      },
      select: {
        id: true,
        emotionTag: true,
        customEmotionTag: true,
        status: true,
        sentAt: true,
        createdAt: true,
      },
    }),
    prisma.messageRecipient.findMany({
      where: {
        receiverUserId: userId,
        receiverDeletedAt: null,
        message: {
          sentAt: {
            gte: range.start,
            lt: range.end,
          },
        },
      },
      select: {
        readAt: true,
        message: {
          select: {
            emotionTag: true,
            customEmotionTag: true,
            sentAt: true,
          },
        },
      },
    }),
  ]);

  return {
    month: range.month,
    sent: {
      total: sentMessages.length,
      arrived: sentMessages.filter((message) => Boolean(message.sentAt)).length,
      byEmotion: countEmotions(sentMessages),
      byStatus: countBy(sentMessages.map((message) => message.status)),
    },
    received: {
      total: receivedRecipients.length,
      read: receivedRecipients.filter((recipient) => Boolean(recipient.readAt)).length,
      byEmotion: countEmotions(receivedRecipients.map((recipient) => recipient.message)),
    },
  };
}

function resolveMonthRange(month?: string) {
  const now = new Date();
  const matched = month?.match(/^(\d{4})-(\d{2})$/);
  const year = matched ? Number(matched[1]) : now.getUTCFullYear();
  const monthIndex = matched ? Number(matched[2]) - 1 : now.getUTCMonth();
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0));

  return {
    month: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
    start,
    end,
  };
}

function countEmotions(items: Array<{ emotionTag?: string | null; customEmotionTag?: string | null }>) {
  const counts = new Map<string, { emotionTag: string | null; customEmotionTag: string | null; count: number }>();

  for (const item of items) {
    const key = `${item.emotionTag ?? "NONE"}:${item.customEmotionTag ?? ""}`;
    const previous = counts.get(key);

    if (previous) {
      previous.count += 1;
      continue;
    }

    counts.set(key, {
      emotionTag: item.emotionTag ?? null,
      customEmotionTag: item.customEmotionTag ?? null,
      count: 1,
    });
  }

  return [...counts.values()].sort((a, b) => b.count - a.count);
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}
