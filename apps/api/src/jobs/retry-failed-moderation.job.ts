import { AttachmentOcrStatus, MessageStatus, ModerationAttemptStatus, Prisma } from "@maeari/database";
import { config } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { createPublicToken, createTokenPreview, hashPublicToken } from "../lib/tokens.js";
import { getModerationInputHash, moderateMessageWithRetry } from "../modules/moderation/moderation.service.js";
import {
  analyzeStoredAttachmentForOcr,
  buildAttachmentOcrText,
  hasFailedOcr,
  mergeContentWithOcrText,
  type AttachmentOcrResult,
} from "../modules/moderation/image-ocr.service.js";

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
      attachments: true,
    },
    orderBy: {
      moderationNextRetryAt: "asc",
    },
    take: 50,
  });

  for (const message of messages) {
    const attachmentOcrResults = await refreshFailedAttachmentOcr(message.attachments);
    const attachmentOcrText = buildAttachmentOcrText(attachmentOcrResults);
    const moderationInput = {
      title: message.title,
      content: mergeContentWithOcrText(message.content, attachmentOcrText),
      emotionTag: message.customEmotionTag ?? message.emotionTag,
    };
    const moderation = hasFailedOcr(attachmentOcrResults)
      ? {
          allowed: "unavailable" as const,
          retryAfter: new Date(Date.now() + 24 * 60 * 60 * 1000),
          reason: "IMAGE_OCR_FAILED",
        }
      : await moderateMessageWithRetry(moderationInput);
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

async function refreshFailedAttachmentOcr(
  attachments: Array<{
    id: string;
    mimeType: string;
    storageKey: string;
    ocrStatus: AttachmentOcrStatus;
    ocrText: string | null;
    ocrConfidence: number | null;
    ocrError: string | null;
    ocrCheckedAt: Date | null;
  }>,
): Promise<AttachmentOcrResult[]> {
  const results: AttachmentOcrResult[] = [];

  for (const attachment of attachments) {
    if (attachment.ocrStatus !== AttachmentOcrStatus.FAILED) {
      results.push({
        ocrStatus: attachment.ocrStatus,
        ocrText: attachment.ocrText,
        ocrConfidence: attachment.ocrConfidence,
        ocrError: attachment.ocrError,
        ocrCheckedAt: attachment.ocrCheckedAt,
      });
      continue;
    }

    const result = await analyzeStoredAttachmentForOcr(attachment);
    await prisma.messageAttachment.update({
      where: { id: attachment.id },
      data: result,
    });
    results.push(result);
  }

  return results;
}
