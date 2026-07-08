import type { Message, MessageAccessToken, MessageAttachment, MessageRecipient, User } from "@maeari/database";
import { messageThemeEnvelopeByTheme, type MessageTheme as SharedMessageTheme } from "@maeari/shared";
import { config } from "../../config/env.js";
import { getListCustomEmotionTag } from "./emotion-tags.js";

type RecipientWithAccessToken = MessageRecipient & {
  accessTokens?: MessageAccessToken[];
};

type MessageThumbnailAttachment = Pick<MessageAttachment, "id" | "publicUrl" | "originalName">;

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
  const themeEnvelope = getMessageThemeEnvelope(message.theme);
  const thumbnail = buildMessageThumbnail(message.attachments, themeEnvelope);

  return {
    id: message.id,
    title: message.title,
    emotionTag: message.emotionTag,
    customEmotionTag: getListCustomEmotionTag(message.emotionTag, message.customEmotionTag),
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
    themeEnvelope,
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
      _count?: {
        attachments: number;
      };
    };
  },
) {
  const message = recipient.message;
  const coverAttachment = message.attachments?.[0] ?? null;
  const themeEnvelope = getMessageThemeEnvelope(message.theme);
  const thumbnail = buildMessageThumbnail(message.attachments, themeEnvelope);

  return {
    id: message.id,
    recipientId: recipient.id,
    title: message.title,
    preview: message.content.slice(0, 120),
    emotionTag: message.emotionTag,
    customEmotionTag: getListCustomEmotionTag(message.emotionTag, message.customEmotionTag),
    theme: message.theme,
    coverImageUrl: coverAttachment?.publicUrl ?? null,
    coverImageAlt: coverAttachment?.originalName ?? null,
    attachmentCount: message._count?.attachments ?? message.attachments?.length ?? 0,
    themeEnvelope,
    senderName: message.isSenderHidden ? null : message.senderDisplayName ?? message.sender.nickname,
    arrivedAt: message.isDateHidden ? null : message.sentAt,
    isSenderHidden: message.isSenderHidden,
    isDateHidden: message.isDateHidden,
    readAt: recipient.readAt,
    linkedAt: recipient.accessTokens?.find((token) => token.linkedUserId === recipient.receiverUserId)?.linkedAt ?? null,
    thumbnail,
  };
}

export function getMessageThemeEnvelope(theme?: string | null) {
  const normalizedTheme = isMessageTheme(theme) ? theme : "LAVENDER";
  return messageThemeEnvelopeByTheme[normalizedTheme];
}

function buildMessageThumbnail(
  attachments: MessageThumbnailAttachment[] | undefined,
  themeEnvelope: ReturnType<typeof getMessageThemeEnvelope>,
) {
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
    url: themeEnvelope.imageUrl,
    source: "THEME" as const,
    attachmentId: null,
    alt: themeEnvelope.alt,
  };
}

function isMessageTheme(theme?: string | null): theme is SharedMessageTheme {
  return typeof theme === "string" && theme in messageThemeEnvelopeByTheme;
}
