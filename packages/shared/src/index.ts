export const emotionTagLabels = {
  THANKS: "고마움",
  CHEER: "응원",
  CELEBRATION: "축하",
  COMFORT: "위로",
  LONGING: "그리움",
  LOVE: "사랑",
  CUSTOM: "직접 입력",
} as const;

export type ReceiverType = "SELF" | "FRIEND" | "OTHER";

export type ReceiverInfo = {
  type: ReceiverType;
  name?: string;
  email?: string;
  phone?: string;
  friendshipId?: string;
  userId?: string;
  preferredChannel?: "AUTO" | "SMS" | "EMAIL";
};

export type NotificationEventType =
  | "MESSAGE_SENT"
  | "ARRIVAL_HINT"
  | "REPLY_RECEIVED"
  | "COLLECTION_DELIVERED"
  | "SYSTEM";

export type NotificationSummaryResponse = {
  unreadCount: number;
};

export type NotificationListItem = {
  id: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

export type NotificationListResponse = {
  unreadCount: number;
  notifications: NotificationListItem[];
};

export type DailyLineResponse = {
  dailyLine: {
    date: string;
    text: string;
    poemTitle: string;
    poet: string;
  };
};

export type MessageThumbnailSource = "ATTACHMENT" | "DEFAULT";

export type MessageThumbnail = {
  url: string;
  source: MessageThumbnailSource;
  attachmentId: string | null;
  alt: string | null;
};

export type MessageReplyListItem = {
  replyId: string;
  messageId: string;
  messageTitle: string;
  senderDisplayName?: string | null;
  isAnonymous?: boolean;
  preview: string;
  createdAt: string;
  senderReadAt?: string | null;
  senderName?: string | null;
  receiverName?: string | null;
  receiverType?: ReceiverType;
};

export type MessageRepliesResponse = {
  replies: MessageReplyListItem[];
};
