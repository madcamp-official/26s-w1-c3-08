import { MessageStatus, ModerationAttemptStatus, Prisma } from "@maeum-arrival/database";
import { config } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { createPublicToken, createTokenPreview, hashPublicToken } from "../lib/tokens.js";
import { getModerationInputHash, moderateMessageWithRetry } from "../modules/moderation/moderation.service.js";

export async function retryFailedModerationMessages() {
  const messages = await prisma.message.findMany({
    where: {
      status: MessageStatus.MODERATION_FAILED,
      moderationNextRetryAt: {
        lte: new Date(),
      },
    },
    include: {
      recipients: {
        include: {
          accessTokens: true,
        },
      },
    },
    orderBy: {
      moderationNextRetryAt: "asc",
    },
    take: 50,
  });

  for (const message of messages) {
    const moderationInput = {
      title: message.title,
      content: message.content,
      emotionTag: message.customEmotionTag ?? message.emotionTag,
    };
    const moderation = await moderateMessageWithRetry(moderationInput);
    const inputHash = getModerationInputHash(moderationInput);

    const attemptNo = message.moderationAttemptCount + config.moderationMaxAttempts;

    if (moderation.allowed === true) {
      await prisma.$transaction(async (tx) => {
        await tx.message.update({
          where: { id: message.id },
          data: {
            status: MessageStatus.PENDING,
            moderationAttemptCount: attemptNo,
            moderationLastCheckedAt: new Date(),
            moderationNextRetryAt: null,
            moderationFailureReason: null,
            moderationFeedback: null,
            moderationBlockedCategories: Prisma.JsonNull,
          },
        });

        for (const recipient of message.recipients) {
          if (recipient.accessTokens.some((token) => !token.revokedAt)) {
            continue;
          }

          const rawToken = createPublicToken();

          await tx.messageAccessToken.create({
            data: {
              messageRecipientId: recipient.id,
              tokenHash: hashPublicToken(rawToken),
              tokenPreview: createTokenPreview(rawToken),
            },
          });
        }

        await tx.moderationLog.create({
          data: {
            messageId: message.id,
            attemptNo,
            model: config.openaiModerationModel,
            status: ModerationAttemptStatus.APPROVED,
            inputHash,
            categories: moderation.categories,
            categoryScores: moderation.categoryScores,
          },
        });
      });

      continue;
    }

    if (moderation.allowed === false) {
      await prisma.$transaction(async (tx) => {
        await tx.message.update({
          where: { id: message.id },
          data: {
            status: MessageStatus.BLOCKED,
            moderationAttemptCount: attemptNo,
            moderationLastCheckedAt: new Date(),
            moderationNextRetryAt: null,
            moderationFailureReason: moderation.feedback,
            moderationFeedback: moderation.feedback,
            moderationBlockedCategories: moderation.blockedCategories,
          },
        });

        await tx.moderationLog.create({
          data: {
            messageId: message.id,
            attemptNo,
            model: config.openaiModerationModel,
            status: ModerationAttemptStatus.BLOCKED,
            inputHash,
            categories: moderation.categories,
            categoryScores: moderation.categoryScores,
            feedback: moderation.feedback,
          },
        });
      });

      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.message.update({
        where: { id: message.id },
        data: {
          moderationAttemptCount: attemptNo,
          moderationLastCheckedAt: new Date(),
          moderationNextRetryAt: moderation.retryAfter,
          moderationFailureReason: moderation.reason,
        },
      });

      await tx.moderationLog.create({
        data: {
          messageId: message.id,
          attemptNo,
          model: config.openaiModerationModel,
          status: ModerationAttemptStatus.FAILED,
          inputHash,
          errorMessage: moderation.reason,
        },
      });
    });
  }

  return { processed: messages.length };
}
