export const emotionTagLabels = {
  THANKS: "고마움",
  CHEER: "응원",
  CELEBRATION: "축하",
  COMFORT: "위로",
  LONGING: "그리움",
  LOVE: "사랑",
  CUSTOM: "직접 입력",
} as const;

export type ReceiverType = "SELF" | "OTHER";

export type ReceiverInfo = {
  type: ReceiverType;
  name?: string;
  email?: string;
  phone?: string;
};
