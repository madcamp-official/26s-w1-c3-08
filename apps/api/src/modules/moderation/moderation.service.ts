import OpenAI from "openai";
import { config } from "../../config/env.js";
import { hashText } from "../../lib/tokens.js";
import { getModerationFeedback } from "./moderation-feedback.js";
import {
  MESSAGE_SAFETY_POLICY_VERSION,
  MESSAGE_SAFETY_SYSTEM_PROMPT,
  buildMessageSafetyUserPrompt,
  normalizeMessageSafetyAssessment,
  type MessageSafetyAssessment,
} from "./moderation-policy.js";

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
  const localBlock = detectKoreanAbuse(text);

  if (localBlock) {
    return localBlock;
  }

  const response = await openai.moderations.create({
    model: config.openaiModerationModel,
    input: text,
  });

  const result = response.results[0];
  const categories = (result?.categories ?? {}) as unknown as Record<string, boolean>;
  const categoryScores = (result?.category_scores ?? {}) as unknown as Record<string, number>;

  if (!result?.flagged) {
    const policyAssessment = await assessMessageSafety(input);

    if (!policyAssessment.allowed) {
      return toPolicyBlockedResult(policyAssessment);
    }

    return {
      allowed: true,
      categories: {
        ...categories,
        [`policy/${MESSAGE_SAFETY_POLICY_VERSION}`]: false,
      },
      categoryScores: {
        ...categoryScores,
        [`policy/${MESSAGE_SAFETY_POLICY_VERSION}`]: 0,
      },
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
  return [
    `제목: ${input.title}`,
    `감정 태그: ${input.emotionTag ?? "없음"}`,
    `본문:\n${input.content}`,
  ].join("\n\n");
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

async function assessMessageSafety(input: ModerationInput): Promise<MessageSafetyAssessment> {
  const response = await openai.chat.completions.create({
    model: config.openaiGuardrailModel,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: MESSAGE_SAFETY_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: buildMessageSafetyUserPrompt(input),
      },
    ],
  });

  const rawContent = response.choices[0]?.message?.content;

  if (!rawContent) {
    throw new Error("empty OpenAI guardrail response");
  }

  const parsed = parseJsonObject(rawContent);
  const assessment = normalizeMessageSafetyAssessment(parsed);

  if (!assessment) {
    throw new Error("invalid OpenAI guardrail response");
  }

  return assessment;
}

function toPolicyBlockedResult(assessment: MessageSafetyAssessment): ModerationBlockedResult {
  const categories = Object.fromEntries(
    assessment.categories.length > 0
      ? assessment.categories.map((category) => [`policy/${category}`, true])
      : [["policy/unsafe-message", true]],
  );

  categories[`policy/${MESSAGE_SAFETY_POLICY_VERSION}`] = true;

  const categoryScores = Object.fromEntries(
    Object.keys(categories).map((category) => [category, severityScore(assessment.severity)]),
  );

  return {
    allowed: false,
    feedback:
      assessment.feedback ||
      "받는 사람이 편안하게 읽을 수 있도록 표현을 조금 더 부드럽게 다듬어 주세요.",
    blockedCategories: Object.keys(categories),
    categories,
    categoryScores,
  };
}

function parseJsonObject(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("OpenAI guardrail response did not include JSON");
    }

    return JSON.parse(match[0]);
  }
}

function severityScore(severity: MessageSafetyAssessment["severity"]) {
  if (severity === "high") {
    return 1;
  }

  if (severity === "medium") {
    return 0.85;
  }

  if (severity === "low") {
    return 0.5;
  }

  return 0;
}

function detectKoreanAbuse(text: string): ModerationBlockedResult | null {
  const normalized = normalizeKoreanAbuseText(text);
  const patterns = [
    /개(?:새|세|쌔|쎄|섀|쉐|쉑)끼?/,
    /개자식/,
    /씨발|시발|쉬발|쒸발|씨바|시바|쉬바|쒸바|ㅅㅂ|ㅆㅂ/,
    /미친(?:놈|년|새끼|쉐끼|섀끼|새키)?|ㅁㅊ/,
    /멍청(?:이|한|해|하)?/,
    /병신|븅신|빙신|븽신|ㅂㅅ/,
    /좆|존나|졸라|ㅈ나|ㅈㄴ|ㅈ같/,
    /지랄|쥐랄|ㅈㄹ/,
    /꺼져|ㄲㅈ/,
    /씹(?:새|세|쌔|쎄|섀|쉐|쉑)?끼?/,
    /땅딸보|땡중|멸거지|돌마니|돌추/,
    /똥개|똥꼬충|딸빵|딸딸이|딸피/,
    /마스터베이션아미|masturbationarmy/,
  ];

  if (!patterns.some((pattern) => pattern.test(normalized))) {
    return null;
  }

  const categories = {
    harassment: true,
    "korean/profanity": true,
  };

  return {
    allowed: false,
    feedback: getModerationFeedback(categories),
    blockedCategories: Object.keys(categories),
    categories,
    categoryScores: {
      harassment: 1,
      "korean/profanity": 1,
    },
  };
}

function normalizeKoreanAbuseText(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[0-9０-９]/g, "")
    .replace(/[^\p{L}ㄱ-ㅎㅏ-ㅣ]+/gu, "")
    .replace(/(.)\1{2,}/gu, "$1$1");
}
