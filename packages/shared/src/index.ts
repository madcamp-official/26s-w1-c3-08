export const emotionTagLabels = {
  THANKS: "고마움",
  CHEER: "응원",
  CELEBRATION: "축하",
  COMFORT: "위로",
  LONGING: "그리움",
  LOVE: "사랑",
  CUSTOM: "직접 입력",
} as const;

export type EmotionTag = keyof typeof emotionTagLabels;

export type MessageTheme = "LAVENDER" | "MOSS" | "SUNSET" | "MIDNIGHT" | "PAPER";

export type MessageThemeEnvelope = {
  theme: MessageTheme;
  label: string;
  imageUrl: string;
  alt: string;
};

export const messageThemeEnvelopeByTheme = {
  LAVENDER: {
    theme: "LAVENDER",
    label: "보라빛 봉투",
    imageUrl: "/images/maeari-envelope-theme-lavender.png",
    alt: "보라빛 봉투",
  },
  MOSS: {
    theme: "MOSS",
    label: "차분한 초록",
    imageUrl: "/images/maeari-envelope-theme-moss.png",
    alt: "차분한 초록 봉투",
  },
  SUNSET: {
    theme: "SUNSET",
    label: "저녁노을",
    imageUrl: "/images/maeari-envelope-theme-sunset.png",
    alt: "저녁노을 봉투",
  },
  MIDNIGHT: {
    theme: "MIDNIGHT",
    label: "한밤의 별",
    imageUrl: "/images/maeari-envelope-theme-midnight.png",
    alt: "한밤의 별 봉투",
  },
  PAPER: {
    theme: "PAPER",
    label: "종이 편지",
    imageUrl: "/images/maeari-envelope-theme-paper.png",
    alt: "종이 편지 봉투",
  },
} as const satisfies Record<MessageTheme, MessageThemeEnvelope>;

export const messageThemeOptions = [
  messageThemeEnvelopeByTheme.PAPER,
  messageThemeEnvelopeByTheme.MIDNIGHT,
  messageThemeEnvelopeByTheme.SUNSET,
  messageThemeEnvelopeByTheme.MOSS,
  messageThemeEnvelopeByTheme.LAVENDER,
] as const;

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

export type RecipientHistoryPreferredChannel = "AUTO" | "SMS" | "EMAIL";

export type RecipientHistoryItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  maskedEmail: string | null;
  maskedPhone: string | null;
  preferredChannel: RecipientHistoryPreferredChannel;
  lastUsedAt: string;
  sendCount: number;
};

export type RecipientHistoryResponse = {
  recipients: RecipientHistoryItem[];
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

export type AccountSetupStatus = {
  hasVerifiedStrictPhone: boolean;
  requiresSignupPhoneVerification: boolean;
  hasCompletedOnboarding: boolean;
};

export type MeResponse = {
  user: {
    id: string;
    kakaoId: string;
    nickname: string;
    email?: string | null;
    friendCode: string;
    onboardingNote?: string | null;
    suspendedAt?: string | null;
    isAdmin: boolean;
  };
  accountSetup: AccountSetupStatus;
};

export type CommunicationBlockDirection = "SEND_TO" | "RECEIVE_FROM";

export type CommunicationBlockTargetType = "USER" | "EMAIL" | "PHONE";

export type CommunicationBlockListItem = {
  id: string;
  direction: CommunicationBlockDirection;
  targetType: CommunicationBlockTargetType;
  targetUserId: string | null;
  targetDisplayName: string | null;
  targetMaskedValue: string | null;
  targetLabel: string | null;
  createdAt: string;
};

export type CommunicationBlocksResponse = {
  blocks: CommunicationBlockListItem[];
};

export type CreateCommunicationBlockRequest = {
  direction: CommunicationBlockDirection;
  target:
    | {
        type: "USER";
        userId: string;
      }
    | {
        type: "EMAIL";
        value: string;
        label?: string;
      }
    | {
        type: "PHONE";
        value: string;
        label?: string;
      };
};

export type CreateCommunicationBlockResponse = {
  block: CommunicationBlockListItem;
  created: boolean;
};

export type MessageThumbnailSource = "ATTACHMENT" | "THEME" | "DEFAULT";

export type MessageThumbnail = {
  url: string;
  source: MessageThumbnailSource;
  attachmentId: string | null;
  alt: string | null;
};

export type ReceivedMessageListItem = {
  id: string;
  recipientId: string;
  title: string;
  preview: string;
  emotionTag?: EmotionTag | null;
  customEmotionTag?: string | null;
  theme: MessageTheme | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  attachmentCount: number;
  thumbnail: MessageThumbnail;
  themeEnvelope: MessageThemeEnvelope;
  senderName?: string | null;
  arrivedAt?: string | null;
  isSenderHidden: boolean;
  isDateHidden: boolean;
  readAt?: string | null;
  linkedAt?: string | null;
};

export type ReceivedMessagesResponse = {
  messages: ReceivedMessageListItem[];
};

export type ArchivedMessagesResponse = ReceivedMessagesResponse;

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
