import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import { hashPublicToken } from "../../lib/tokens.js";

type LinkMessageInput = {
  token: string;
  userId: string;
};

export async function linkMessageToUser({ token, userId }: LinkMessageInput) {
  if (!token) {
    throw new AppError("MESSAGE_TOKEN_REQUIRED", "보관할 마음의 링크 정보를 찾을 수 없어요.", 400);
  }

  const tokenHash = hashPublicToken(token);
  const accessToken = await prisma.messageAccessToken.findUnique({
    where: { tokenHash },
    include: {
      recipient: {
        include: {
          message: {
            select: {
              id: true,
              status: true,
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
    throw new AppError("MESSAGE_TOKEN_EXPIRED", "이 마음을 보관할 수 있는 시간이 지났어요.", 410);
  }

  if (accessToken.linkedUserId && accessToken.linkedUserId !== userId) {
    throw new AppError("MESSAGE_TOKEN_ALREADY_LINKED", "이미 다른 계정에 보관된 마음이에요.", 409);
  }

  if (
    accessToken.linkedUserId === userId &&
    accessToken.recipient.receiverUserId === userId
  ) {
    return {
      messageId: accessToken.recipient.messageId,
      linked: true,
      redirectTo: "/inbox",
    };
  }

  return prisma.$transaction(async (tx) => {
    await tx.messageRecipient.update({
      where: { id: accessToken.messageRecipientId },
      data: { receiverUserId: userId },
    });

    await tx.messageAccessToken.update({
      where: { tokenHash },
      data: {
        linkedUserId: userId,
        linkedAt: new Date(),
      },
    });

    return {
      messageId: accessToken.recipient.messageId,
      linked: true,
      redirectTo: "/inbox",
    };
  });
}
