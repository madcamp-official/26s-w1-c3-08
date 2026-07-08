const CUSTOM_EMOTION_TAG: MessageEmotionTag = "CUSTOM";
const CUSTOM_EMOTION_TAG_MAX_LENGTH = 40;

export type MessageEmotionTag = "THANKS" | "CHEER" | "CELEBRATION" | "COMFORT" | "LONGING" | "LOVE" | "CUSTOM";

type ResolvedMessageEmotionTags = {
  emotionTag: MessageEmotionTag | null;
  customEmotionTag: string | null;
};

export function normalizeCustomEmotionTag(value?: string | null) {
  const normalized = value
    ?.normalize("NFKC")
    .trim()
    .replace(/^[\s\p{P}\p{S}]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  return Array.from(normalized).slice(0, CUSTOM_EMOTION_TAG_MAX_LENGTH).join("");
}

export function resolveMessageEmotionTags(
  emotionTag?: MessageEmotionTag | null,
  customEmotionTag?: string | null,
): ResolvedMessageEmotionTags {
  if (emotionTag !== CUSTOM_EMOTION_TAG) {
    return {
      emotionTag: emotionTag ?? null,
      customEmotionTag: null,
    };
  }

  return {
    emotionTag: CUSTOM_EMOTION_TAG,
    customEmotionTag: normalizeCustomEmotionTag(customEmotionTag),
  };
}

export function getListCustomEmotionTag(emotionTag?: string | null, customEmotionTag?: string | null) {
  return emotionTag === CUSTOM_EMOTION_TAG ? null : customEmotionTag ?? null;
}

export function getDisplayCustomEmotionTag(emotionTag?: string | null, customEmotionTag?: string | null) {
  return emotionTag === CUSTOM_EMOTION_TAG ? normalizeCustomEmotionTag(customEmotionTag) : null;
}
