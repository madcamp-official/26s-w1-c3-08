import type { Message, MessageAccessToken, MessageRecipient, User } from "@maeari/database";
import { config } from "../../config/env.js";

type RecipientWithAccessToken = MessageRecipient & {
  accessTokens?: MessageAccessToken[];
};

export function toPublicUrl(rawToken?: string | null) {
  if (!rawToken) {
    return null;
  }

  return `${config.serviceUrl}/arrival/${rawToken}`;
}

export function mapMessageListItem(
  message: Message & {
    recipients: RecipientWithAccessToken[];
  },
) {
  const recipient = message.recipients[0];

  return {
    id: message.id,
    title: message.title,
    emotionTag: message.emotionTag,
    customEmotionTag: message.customEmotionTag,
    scheduledAt: message.scheduledAt,
    sentAt: message.sentAt,
    status: message.status,
    isSenderHidden: message.isSenderHidden,
    isDateHidden: message.isDateHidden,
    moderationNextRetryAt: message.moderationNextRetryAt,
    receiver: recipient
      ? {
          id: recipient.id,
          type: recipient.receiverType,
          name: recipient.receiverName,
          email: recipient.receiverEmail,
          phone: recipient.receiverPhone,
          deliveryStatus: recipient.deliveryStatus,
          deliveredAt: recipient.deliveredAt,
          readAt: recipient.readAt,
        }
      : null,
    hasPublicLink: Boolean(recipient?.accessTokens?.some((token) => !token.revokedAt)),
  };
}

export function mapReceivedItem(
  recipient: MessageRecipient & {
    accessTokens?: Pick<MessageAccessToken, "linkedAt" | "linkedUserId">[];
    message: Message & {
      sender: Pick<User, "id" | "nickname">;
    };
  },
) {
  const message = recipient.message;

  return {
    id: message.id,
    recipientId: recipient.id,
    title: message.title,
    preview: message.content.slice(0, 120),
    emotionTag: message.emotionTag,
    customEmotionTag: message.customEmotionTag,
    senderName: message.isSenderHidden ? null : message.sender.nickname,
    arrivedAt: message.isDateHidden ? null : message.sentAt,
    isSenderHidden: message.isSenderHidden,
    isDateHidden: message.isDateHidden,
    readAt: recipient.readAt,
    linkedAt: recipient.accessTokens?.find((token) => token.linkedUserId === recipient.receiverUserId)?.linkedAt ?? null,
  };
}
