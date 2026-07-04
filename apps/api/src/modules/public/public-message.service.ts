import { MessageStatus } from "@maeari/database";
import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import { hashPublicToken } from "../../lib/tokens.js";

export async function getPublicMessage(rawToken: string) {
  if (!rawToken) {
    throw new AppError("MESSAGE_TOKEN_REQUIRED", "도착한 마음의 링크 정보를 찾을 수 없어요.", 400);
  }

  const tokenHash = hashPublicToken(rawToken);
  const accessToken = await prisma.messageAccessToken.findUnique({
    where: { tokenHash },
    include: {
      recipient: {
        include: {
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
      },
    },
  });

  if (!accessToken || accessToken.revokedAt) {
    throw new AppError("MESSAGE_TOKEN_NOT_FOUND", "도착한 마음을 찾을 수 없어요.", 404);
  }

  if (accessToken.expiresAt && accessToken.expiresAt < new Date()) {
    throw new AppError("MESSAGE_TOKEN_EXPIRED", "이 마음을 열람할 수 있는 시간이 지났어요.", 410);
  }

  const message = accessToken.recipient.message;

  if (message.status === MessageStatus.PENDING) {
    throw new AppError("MESSAGE_NOT_ARRIVED", "아직 도착하지 않은 마음이에요.", 403, {
      scheduledAt: message.isDateHidden ? null : message.scheduledAt,
    });
  }

  if (message.status !== MessageStatus.SENT) {
    throw new AppError("MESSAGE_UNAVAILABLE", "지금은 이 마음을 열람할 수 없어요.", 409);
  }

  await prisma.messageAccessToken.update({
    where: { tokenHash },
    data: {
      openCount: { increment: 1 },
      firstOpenedAt: accessToken.firstOpenedAt ?? new Date(),
      lastOpenedAt: new Date(),
    },
  });

  return {
    id: message.id,
    title: message.title,
    content: message.content,
    emotionTag: message.emotionTag,
    customEmotionTag: message.customEmotionTag,
    senderName: message.isSenderHidden ? null : message.sender.nickname,
    arrivedAt: message.isDateHidden ? null : message.sentAt,
    isSenderHidden: message.isSenderHidden,
    isDateHidden: message.isDateHidden,
    linked: Boolean(accessToken.linkedUserId),
    canSuppressEmailNotification: Boolean(accessToken.recipient.receiverEmail),
    canSuppressSmsNotification: Boolean(accessToken.recipient.receiverPhone),
  };
}
