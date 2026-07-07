import OpenAI from "openai";
import { Prisma } from "@maeari/database";
import { config } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";

const KST_TIME_ZONE = "Asia/Seoul";
const MAX_GENERATION_ATTEMPTS = 2;

const openai = new OpenAI({
  apiKey: config.openaiApiKey,
});

export async function getTodayDailyLine(now = new Date()) {
  return getOrCreateDailyLineSelection(toKstDateString(now));
}

export async function ensureTodayDailyLine(now = new Date()) {
  const dailyLine = await getTodayDailyLine(now);
  return {
    date: dailyLine.date,
    dailyLineId: dailyLine.id,
  };
}

async function getOrCreateDailyLineSelection(date: string) {
  const existing = await prisma.dailyLineSelection.findUnique({
    where: { date },
    include: { dailyLine: true },
  });

  if (existing) {
    return mapDailyLineSelection(existing.date, existing.dailyLine);
  }

  return createGeneratedDailyLineSelection(date);
}

async function createGeneratedDailyLineSelection(date: string) {
  const generated = await generateDailyLine(date);
  try {
    const selection = await prisma.$transaction(async (tx) => {
      const dailyLine = await tx.dailyLine.create({
        data: {
          text: generated.text,
          poemTitle: generated.poemTitle,
          poet: generated.poet,
          sourceNote: generated.sourceNote,
          sortOrder: dayIndex(date),
        },
      });

      return tx.dailyLineSelection.create({
        data: {
          date,
          dailyLineId: dailyLine.id,
        },
        include: { dailyLine: true },
      });
    });

    return mapDailyLineSelection(selection.date, selection.dailyLine);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const racedSelection = await prisma.dailyLineSelection.findUniqueOrThrow({
        where: { date },
        include: { dailyLine: true },
      });

      return mapDailyLineSelection(racedSelection.date, racedSelection.dailyLine);
    }

    throw error;
  }
}

async function generateDailyLine(date: string): Promise<GeneratedDailyLine> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      const response = await openai.chat.completions.create({
        model: config.dailyLineOpenaiModel,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: DAILY_LINE_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              `KST date: ${date}`,
              "꽃, 꽃잎, 눈꽃, 매화, 진달래, 국화, 봄꽃 등 꽃 이미지와 관련된 시 일부를 골라 주세요.",
              "반드시 JSON object만 반환하세요.",
            ].join("\n"),
          },
        ],
      });
      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error("empty OpenAI daily line response");
      }

      return normalizeGeneratedDailyLine(parseJsonObject(content), date);
    } catch (error) {
      lastError = error;

      if (attempt < MAX_GENERATION_ATTEMPTS) {
        await sleep(500);
      }
    }
  }

  throw new AppError(
    "DAILY_LINE_GENERATION_FAILED",
    getDailyLineGenerationError(lastError),
    503,
  );
}

function mapDailyLineSelection(
  date: string,
  dailyLine: {
    id: string;
    text: string;
    poemTitle: string;
    poet: string;
  },
) {
  return {
    id: dailyLine.id,
    date,
    text: dailyLine.text,
    poemTitle: dailyLine.poemTitle,
    poet: dailyLine.poet,
  };
}

type GeneratedDailyLine = {
  text: string;
  poemTitle: string;
  poet: string;
  sourceNote: string;
};

const DAILY_LINE_SYSTEM_PROMPT = [
  "You generate the Korean service feature '오늘의 한 줄'.",
  "Return exactly one short excerpt from a flower-related poem.",
  "Use only poems that you are confident are public domain or classical works. Prefer Korean poets whose death was more than 70 years ago, such as 김소월, 한용운, 윤동주, or 정지용, when the excerpt is flower-related.",
  "Do not quote living poets, recent poets, contemporary song lyrics, web posts, or any work with uncertain rights.",
  "Do not invent a poem title or poet. If uncertain, choose another clearly eligible poem.",
  "The excerpt must be brief: at most 120 Korean characters and at most two lines.",
  "Return only a JSON object with this shape: {\"text\":\"...\",\"poemTitle\":\"...\",\"poet\":\"...\"}.",
].join("\n");

function normalizeGeneratedDailyLine(value: unknown, date: string): GeneratedDailyLine {
  const record = asRecord(value);
  const text = normalizeRequiredString(record.text, 120);
  const poemTitle = normalizeRequiredString(record.poemTitle, 120);
  const poet = normalizeRequiredString(record.poet, 80);

  if (!text || !poemTitle || !poet) {
    throw new Error("invalid OpenAI daily line response");
  }

  return {
    text,
    poemTitle,
    poet,
    sourceNote: `openai:${config.dailyLineOpenaiModel}:kst:${date}`,
  };
}

function normalizeRequiredString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

function parseJsonObject(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("OpenAI daily line response did not include JSON");
    }

    return JSON.parse(match[0]);
  }
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDailyLineGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown OpenAI daily line error";
  return `오늘의 한 줄을 생성하지 못했어요: ${message.slice(0, 300)}`;
}

function toKstDateString(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function dayIndex(date: string) {
  const [year = "1970", month = "01", day = "01"] = date.split("-");
  return Math.floor(Date.UTC(Number(year), Number(month) - 1, Number(day)) / 86_400_000);
}
