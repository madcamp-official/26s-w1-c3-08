import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { config } from "../config/env.js";
import { AppError } from "../lib/app-error.js";

export function errorMiddleware(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) {
  if (error instanceof AppError) {
    return response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  if (error instanceof multer.MulterError) {
    const { code, message, statusCode } = mapMulterError(error);

    return response.status(statusCode).json({
      error: {
        code,
        message,
      },
    });
  }

  if (isPayloadTooLargeError(error)) {
    return response.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: getAttachmentLimitMessage(),
      },
    });
  }

  if (error instanceof ZodError) {
    return response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "입력값을 다시 확인해 주세요.",
        details: error.flatten(),
      },
    });
  }

  console.error(error);

  return response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "서버에서 문제가 발생했어요. 잠시 뒤 다시 시도해 주세요.",
    },
  });
}

function mapMulterError(error: multer.MulterError) {
  if (error.code === "LIMIT_FILE_SIZE") {
    return {
      statusCode: 413,
      code: "ATTACHMENT_TOO_LARGE",
      message: `첨부 이미지 용량이 너무 커요. 이미지는 최대 ${formatBytes(config.maxAttachmentBytes)} 이하로 첨부해 주세요.`,
    };
  }

  if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE" || error.code === "LIMIT_PART_COUNT") {
    return {
      statusCode: 400,
      code: "TOO_MANY_ATTACHMENTS",
      message: `이미지는 최대 ${config.maxAttachmentCount}개까지 첨부할 수 있어요.`,
    };
  }

  return {
    statusCode: 400,
    code: "ATTACHMENT_UPLOAD_INVALID",
    message: "첨부 이미지를 다시 확인해 주세요.",
  };
}

function isPayloadTooLargeError(error: unknown): error is { type?: string; status?: number; statusCode?: number } {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { type?: string; status?: number; statusCode?: number };
  return candidate.type === "entity.too.large" || candidate.status === 413 || candidate.statusCode === 413;
}

function getAttachmentLimitMessage() {
  return `첨부 이미지 용량이 너무 커요. 이미지는 최대 ${config.maxAttachmentCount}개, 각 ${formatBytes(
    config.maxAttachmentBytes,
  )} 이하로 첨부해 주세요.`;
}

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb}MB` : `${mb.toFixed(1)}MB`;
}
