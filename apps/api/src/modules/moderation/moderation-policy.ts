import type { ModerationInput } from "./moderation.service.js";

export const MESSAGE_SAFETY_POLICY_VERSION = "maeari-message-safety-v1";

export type MessageSafetyAssessment = {
  allowed: boolean;
  categories: string[];
  severity: "none" | "low" | "medium" | "high";
  feedback: string;
  rationale: string;
};

export const MESSAGE_SAFETY_SYSTEM_PROMPT = `
You are an advanced content moderation AI for a personal scheduled messaging service. Your primary task is to analyze personal letters written by a sender to a recipient and determine if the content violates safety guidelines.

Your analysis must go beyond simple keyword matching and focus on the CONTEXT, TONE, and INTENT of the message. 

[Language & Cultural Context (Korean)]
The input messages will be primarily in Korean. You must strictly account for Korean internet culture and interpersonal nuances:
- Friendly Banter: Korean close friends often use aggressive-sounding slang or swear words (e.g., "미친", "새끼", "존나", "바보") affectionately or playfully. 
- Do NOT flag these words as "Toxicity" or "Harassment" if the overall tone of the letter is clearly friendly, teasing, nostalgic, or joking.
- Rely heavily on the emotional context of the surrounding sentences to determine if the intent is truly malicious.

[Moderation Guidelines]
Flag the message as HARMFUL (true) if it contains:
1. Targeted Harassment: Direct insults, degradation, or bullying aimed at the recipient or a specific individual with clear malicious intent.
2. Severe Toxicity & Profanity: Excessive, aggressive use of swear words intended to attack, demean, or cause emotional distress.
3. Hate Speech: Slurs or discriminatory language based on race, gender, sexual orientation, religion, or disability.
4. Threats & Violence: Any credible threat of physical harm, self-harm encouragement, or severe intimidation.

[Contextual Nuance (Do NOT Flag)]
Mark the message as SAFE (false) in these contextual situations:
- Affectionate Slang: As mentioned above, rough language used between close friends.
- Self-Deprecation or Venting: The sender using strong language to describe their own bad day or situation, without attacking the recipient.
- Emotional but Safe: Expressions of sadness, regret, or frustration that do not cross into abuse or threats.

[Output Format]
You must respond ONLY with a valid JSON object in the following format:
{
  "allowed": true/false,
  "categories": ["harassment" | "hate" | "sexual" | "violence" | "self-harm" | "profanity" | "toxicity" | "threat"],
  "severity": "none" | "low" | "medium" | "high",
  "feedback": "A short Korean message for the sender. If allowed is true, use an empty string.",
  "rationale": "Briefly explain the contextual reason for your decision in 1-2 sentences."
}
`.trim();

export function buildMessageSafetyUserPrompt(input: ModerationInput) {
  return `
Assess this scheduled message for delivery safety.

Title:
${input.title}

Emotion tag:
${input.emotionTag ?? "(none)"}

Body:
${input.content}
`.trim();
}

export function normalizeMessageSafetyAssessment(value: unknown): MessageSafetyAssessment | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const allowed = normalizeAllowed(raw);
  const categories = Array.isArray(raw.categories)
    ? raw.categories.filter((item): item is string => typeof item === "string")
    : normalizeLegacyCategories(raw.violation_category);
  const severity = normalizeSeverity(raw.severity) ?? normalizeLegacySeverity(raw.confidence_score, allowed);
  const feedback =
    typeof raw.feedback === "string"
      ? raw.feedback.trim()
      : allowed === false
        ? "받는 사람이 편안하게 읽을 수 있도록 표현을 조금 더 부드럽게 다듬어 주세요."
        : "";
  const rationale =
    typeof raw.rationale === "string"
      ? raw.rationale.trim()
      : typeof raw.reason === "string"
        ? raw.reason.trim()
        : "";

  if (allowed === null || !severity) {
    return null;
  }

  return {
    allowed,
    categories,
    severity,
    feedback,
    rationale,
  };
}

function normalizeAllowed(raw: Record<string, unknown>) {
  if (typeof raw.allowed === "boolean") {
    return raw.allowed;
  }

  if (typeof raw.is_harmful === "boolean") {
    return !raw.is_harmful;
  }

  return null;
}

function normalizeLegacyCategories(value: unknown) {
  if (typeof value !== "string" || value.toLowerCase() === "none") {
    return [];
  }

  const category = value.trim().toLowerCase().replace(/\s+/g, "-");
  const map: Record<string, string> = {
    "hate-speech": "hate",
    harassment: "harassment",
    toxicity: "toxicity",
    threat: "threat",
  };

  return [map[category] ?? category];
}

function normalizeSeverity(value: unknown): MessageSafetyAssessment["severity"] | null {
  if (value === "none" || value === "low" || value === "medium" || value === "high") {
    return value;
  }

  return null;
}

function normalizeLegacySeverity(
  confidence: unknown,
  allowed: boolean | null,
): MessageSafetyAssessment["severity"] | null {
  if (allowed === true) {
    return "none";
  }

  if (allowed !== false) {
    return null;
  }

  if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
    return "medium";
  }

  if (confidence >= 0.85) {
    return "high";
  }

  if (confidence >= 0.5) {
    return "medium";
  }

  return "low";
}
