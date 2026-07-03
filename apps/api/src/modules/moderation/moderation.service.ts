import OpenAI from "openai";
import { config } from "../../config/env.js";
import { hashText } from "../../lib/tokens.js";
import { getModerationFeedback } from "./moderation-feedback.js";

export type ModerationInput = {
  title: string;
  content: string;
  emotionTag?: string | null;
};

export type ModerationAllowedResult = {
  allowed: true;
  categories: Record<string, boolean>;
  categoryScores: Record<string, number>;
};

export type ModerationBlockedResult = {
  allowed: false;
  feedback: string;
  blockedCategories: string[];
  categories: Record<string, boolean>;
  categoryScores: Record<string, number>;
};

export type ModerationUnavailableResult = {
  allowed: "unavailable";
  retryAfter: Date;
  reason: string;
};

export type ModerationResult =
  | ModerationAllowedResult
  | ModerationBlockedResult
  | ModerationUnavailableResult;

const openai = new OpenAI({
  apiKey: config.openaiApiKey,
});

export async function moderateMessage(input: ModerationInput): Promise<ModerationAllowedResult | ModerationBlockedResult> {
  const text = buildModerationInputText(input);

  const response = await openai.moderations.create({
    model: config.openaiModerationModel,
    input: text,
  });

  const result = response.results[0];
  const categories = (result?.categories ?? {}) as unknown as Record<string, boolean>;
  const categoryScores = (result?.category_scores ?? {}) as unknown as Record<string, number>;

  if (!result?.flagged) {
    return {
      allowed: true,
      categories,
      categoryScores,
    };
  }

  const blockedCategories = Object.entries(categories)
    .filter(([, blocked]) => blocked)
    .map(([category]) => category);

  return {
    allowed: false,
    feedback: getModerationFeedback(categories),
    blockedCategories,
    categories,
    categoryScores,
  };
}

export function buildModerationInputText(input: ModerationInput) {
  return [input.title, input.content, input.emotionTag].filter(Boolean).join("\n\n");
}

export function getModerationInputHash(input: ModerationInput) {
  return hashText(buildModerationInputText(input));
}

export async function moderateMessageWithRetry(input: ModerationInput): Promise<ModerationResult> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.moderationMaxAttempts; attempt += 1) {
    try {
      return await moderateMessage(input);
    } catch (error) {
      lastError = error;

      if (attempt < config.moderationMaxAttempts) {
        await sleep(500);
      }
    }
  }

  return {
    allowed: "unavailable",
    retryAfter: addDays(new Date(), 1),
    reason: getModerationFailureReason(lastError),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getModerationFailureReason(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  return "unknown moderation error";
}
