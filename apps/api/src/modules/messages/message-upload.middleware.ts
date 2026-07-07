import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { config } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: config.maxAttachmentCount,
    fileSize: config.maxAttachmentBytes,
    fieldSize: 256 * 1024,
    fields: 1,
    // Busboy can count the multipart closing boundary while enforcing parts.
    // Keep file/field limits strict, but leave one spare part so 1 payload + 3 files is accepted.
    parts: config.maxAttachmentCount + 2,
  },
  fileFilter(_request, file, callback) {
    if (!allowedImageTypes.has(file.mimetype) || !hasAllowedImageExtension(file.originalname)) {
      callback(new AppError("ATTACHMENT_TYPE_UNSUPPORTED", "지원하지 않는 이미지 형식이에요.", 400));
      return;
    }

    callback(null, true);
  },
}).array("attachments", config.maxAttachmentCount);

export function parseCreateMessageRequest(request: Request, response: Response, next: NextFunction) {
  if (!request.is("multipart/form-data")) {
    next();
    return;
  }

  upload(request, response, (error) => {
    if (error) {
      next(error);
      return;
    }

    const payload = request.body?.payload;

    if (typeof payload !== "string" || payload.length === 0) {
      next(new AppError("MESSAGE_PAYLOAD_REQUIRED", "메시지 내용을 다시 확인해 주세요.", 400));
      return;
    }

    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      next(new AppError("MESSAGE_PAYLOAD_INVALID", "메시지 내용을 다시 확인해 주세요.", 400));
      return;
    }

    if (!parsedPayload || typeof parsedPayload !== "object" || Array.isArray(parsedPayload)) {
      next(new AppError("MESSAGE_PAYLOAD_INVALID", "메시지 내용을 다시 확인해 주세요.", 400));
      return;
    }

    const files = Array.isArray(request.files) ? request.files : [];
    const totalBytes = files.reduce((total, file) => total + file.size, 0);

    if (totalBytes > config.maxAttachmentTotalBytes) {
      next(new AppError("ATTACHMENTS_TOO_LARGE", "첨부 이미지 전체 용량이 너무 커요.", 413));
      return;
    }

    request.body = {
      ...parsedPayload,
      attachments: files.map((file) => ({
        fileName: file.originalname,
        mimeType: file.mimetype,
        dataBase64: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
      })),
    };

    next();
  });
}

function hasAllowedImageExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  return [...allowedImageExtensions].some((extension) => normalized.endsWith(extension));
}
