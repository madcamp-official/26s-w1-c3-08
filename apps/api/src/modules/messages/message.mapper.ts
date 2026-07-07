import type { Message, MessageAccessToken, MessageAttachment, MessageRecipient, User } from "@maeari/database";
import { config } from "../../config/env.js";

type RecipientWithAccessToken = MessageRecipient & {
  accessTokens?: MessageAccessToken[];
};

type MessageThumbnailAttachment = Pick<MessageAttachment, "id" | "publicUrl" | "originalName">;

const DEFAULT_MESSAGE_THUMBNAIL_URLS = [
  "/images/maeari-message-default-1.png",
  "/images/maeari-message-default-2.png",
  "/images/maeari-message-default-3.png",
  "/images/maeari-message-default-4.png",
] as const;

export function toPublicUrl(rawToken?: string | null) {
  if (!rawToken) {
    return null;
  }

  return `${config.serviceUrl}/arrival/${rawToken}`;
}

export function mapMessageListItem(
  message: Message & {
    recipients: RecipientWithAccessToken[];
    attachments?: MessageThumbnailAttachment[];
  },
) {
  const recipient = message.recipients[0];
  const thumbnail = buildMessageThumbnail(message.id, message.attachments);

  return {
    id: message.id,
    title: message.title,
    emotionTag: message.emotionTag,
    customEmotionTag: message.customEmotionTag,
    theme: message.theme,
    arrivalMode: message.arrivalMode,
    arrivalWindowStartAt: message.arrivalWindowStartAt,
    arrivalWindowEndAt: message.arrivalWindowEndAt,
    hintAt: message.hintAt,
    scheduledAt: message.scheduledAt,
    sentAt: message.sentAt,
    status: message.status,
    senderDisplayName: message.senderDisplayName,
    isSenderHidden: message.isSenderHidden,
    isDateHidden: message.isDateHidden,
    moderationNextRetryAt: message.moderationNextRetryAt,
    thumbnail,
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
    recipients: message.recipients.map((item) => ({
      id: item.id,
      type: item.receiverType,
      name: item.receiverName,
      email: item.receiverEmail,
      phone: item.receiverPhone,
      deliveryStatus: item.deliveryStatus,
      deliveredAt: item.deliveredAt,
      readAt: item.readAt,
    })),
    receiverCount: message.recipients.length,
    hasPublicLink: Boolean(recipient?.accessTokens?.some((token) => !token.revokedAt)),
  };
}

export function mapReceivedItem(
  recipient: MessageRecipient & {
    accessTokens?: Pick<MessageAccessToken, "linkedAt" | "linkedUserId">[];
    message: Message & {
      sender: Pick<User, "id" | "nickname">;
      attachments?: MessageThumbnailAttachment[];
    };
  },
) {
  const message = recipient.message;
  const thumbnail = buildMessageThumbnail(message.id, message.attachments);

  return {
    id: message.id,
    recipientId: recipient.id,
    title: message.title,
    preview: message.content.slice(0, 120),
    emotionTag: message.emotionTag,
    customEmotionTag: message.customEmotionTag,
    theme: message.theme,
    senderName: message.isSenderHidden ? null : message.senderDisplayName ?? message.sender.nickname,
    arrivedAt: message.isDateHidden ? null : message.sentAt,
    isSenderHidden: message.isSenderHidden,
    isDateHidden: message.isDateHidden,
    readAt: recipient.readAt,
    linkedAt: recipient.accessTokens?.find((token) => token.linkedUserId === recipient.receiverUserId)?.linkedAt ?? null,
    thumbnail,
  };
}

function buildMessageThumbnail(messageId: string, attachments?: MessageThumbnailAttachment[]) {
  const firstAttachment = attachments?.[0];

  if (firstAttachment?.publicUrl) {
    return {
      url: firstAttachment.publicUrl,
      source: "ATTACHMENT" as const,
      attachmentId: firstAttachment.id,
      alt: firstAttachment.originalName ?? null,
    };
  }

  return {
    url: selectDefaultMessageThumbnailUrl(messageId),
    source: "DEFAULT" as const,
    attachmentId: null,
    alt: null,
  };
}

function selectDefaultMessageThumbnailUrl(messageId: string) {
  let hash = 0;

  for (const char of messageId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return DEFAULT_MESSAGE_THUMBNAIL_URLS[hash % DEFAULT_MESSAGE_THUMBNAIL_URLS.length];
}
