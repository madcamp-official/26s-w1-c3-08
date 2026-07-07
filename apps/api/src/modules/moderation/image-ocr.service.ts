import { AttachmentOcrStatus } from "@maeari/database";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Tesseract from "tesseract.js";
import { config } from "../../config/env.js";

export type DraftAttachmentForOcr = {
  fileName?: string | null;
  mimeType: string;
  dataBase64: string;
};

export type StoredAttachmentForOcr = {
  id: string;
  mimeType: string;
  storageKey: string;
  ocrStatus: AttachmentOcrStatus;
};

export type AttachmentOcrResult = {
  ocrStatus: AttachmentOcrStatus;
  ocrText?: string | null;
  ocrConfidence?: number | null;
  ocrError?: string | null;
  ocrCheckedAt?: Date | null;
};

const OCR_SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function analyzeDraftAttachmentsForOcr(
  attachments: DraftAttachmentForOcr[],
): Promise<AttachmentOcrResult[]> {
  const results: AttachmentOcrResult[] = [];

  for (const attachment of attachments) {
    results.push(await analyzeBufferForOcr(decodeAttachment(attachment.dataBase64), attachment.mimeType));
  }

  return results;
}

export async function analyzeStoredAttachmentForOcr(attachment: StoredAttachmentForOcr) {
  try {
    const buffer = await readFile(path.join(config.uploadDir, attachment.storageKey));
    return analyzeBufferForOcr(buffer, attachment.mimeType);
  } catch (error) {
    return {
      ocrStatus: AttachmentOcrStatus.FAILED,
      ocrText: null,
      ocrConfidence: null,
      ocrError: error instanceof Error ? error.message.slice(0, 500) : "OCR_FILE_READ_FAILED",
      ocrCheckedAt: new Date(),
    };
  }
}

export function hasFailedOcr(results: AttachmentOcrResult[]) {
  return results.some((result) => result.ocrStatus === AttachmentOcrStatus.FAILED);
}

export function buildAttachmentOcrText(results: AttachmentOcrResult[]) {
  const text = results
    .map((result, index) => {
      const value = result.ocrText?.trim();
      return value ? `[첨부 이미지 ${index + 1}]\n${value}` : "";
    })
    .filter(Boolean)
    .join("\n\n");

  return text.length > 0 ? text : null;
}

export function mergeContentWithOcrText(content: string, ocrText?: string | null) {
  if (!ocrText) {
    return content;
  }

  return [
    content,
    "첨부 이미지에서 추출된 텍스트:",
    ocrText,
  ].join("\n\n");
}

function decodeAttachment(dataBase64: string) {
  const [, base64] = dataBase64.includes(",") ? dataBase64.split(",", 2) : ["", dataBase64];
  return Buffer.from(base64 ?? "", "base64");
}

async function analyzeBufferForOcr(buffer: Buffer, mimeType: string): Promise<AttachmentOcrResult> {
  const checkedAt = new Date();

  if (!config.imageOcrModerationEnabled) {
    return {
      ocrStatus: AttachmentOcrStatus.SKIPPED,
      ocrText: null,
      ocrConfidence: null,
      ocrError: null,
      ocrCheckedAt: checkedAt,
    };
  }

  if (!OCR_SUPPORTED_TYPES.has(mimeType)) {
    return {
      ocrStatus: AttachmentOcrStatus.FAILED,
      ocrText: null,
      ocrConfidence: null,
      ocrError: "UNSUPPORTED_IMAGE_FOR_OCR",
      ocrCheckedAt: checkedAt,
    };
  }

  try {
    const result = await withTimeout(
      Tesseract.recognize(buffer, config.imageOcrLanguages, {
        logger: () => undefined,
      }),
      config.imageOcrTimeoutMs,
    );
    const rawText = result.data.text.trim();
    const text =
      rawText.length > config.imageOcrMaxTextChars
        ? rawText.slice(0, config.imageOcrMaxTextChars)
        : rawText;

    return {
      ocrStatus: AttachmentOcrStatus.EXTRACTED,
      ocrText: text.length > 0 ? text : null,
      ocrConfidence: typeof result.data.confidence === "number" ? result.data.confidence : null,
      ocrError: null,
      ocrCheckedAt: checkedAt,
    };
  } catch (error) {
    return {
      ocrStatus: AttachmentOcrStatus.FAILED,
      ocrText: null,
      ocrConfidence: null,
      ocrError: error instanceof Error ? error.message.slice(0, 500) : "OCR_FAILED",
      ocrCheckedAt: checkedAt,
    };
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("IMAGE_OCR_TIMEOUT"));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}
