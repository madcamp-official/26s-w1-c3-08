import type { Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import {
  cancelMessage,
  archiveReceivedMessage,
  bulkDeleteMessagesFromMailbox,
  createMessagePublicLink,
  createMessage,
  deleteMessageFromMailbox,
  getMessageDetail,
  listArchivedMessages,
  listReceivedMessages,
  listSentMessages,
  reportMessage,
  unarchiveReceivedMessage,
} from "./message.service.js";

export const createMessageController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const result = await createMessage(request.user.id, request.body);
  response.status(201).json(result);
});

export const listSentMessagesController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json({ messages: await listSentMessages(request.user.id) });
});

export const listReceivedMessagesController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json({ messages: await listReceivedMessages(request.user.id) });
});

export const listArchivedMessagesController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json({ messages: await listArchivedMessages(request.user.id) });
});

export const getMessageDetailController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const messageId = request.params.id;

  if (!messageId) {
    throw new AppError("MESSAGE_ID_REQUIRED", "메시지 정보를 찾을 수 없어요.", 400);
  }

  response.json({ message: await getMessageDetail(request.user.id, messageId) });
});

export const createMessagePublicLinkController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const messageId = request.params.id;

  if (!messageId) {
    throw new AppError("MESSAGE_ID_REQUIRED", "메시지 정보를 찾을 수 없어요.", 400);
  }

  response.status(201).json(await createMessagePublicLink(request.user.id, messageId));
});

export const cancelMessageController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const messageId = request.params.id;

  if (!messageId) {
    throw new AppError("MESSAGE_ID_REQUIRED", "메시지 정보를 찾을 수 없어요.", 400);
  }

  response.json(await cancelMessage(request.user.id, messageId));
});

export const deleteMessageFromMailboxController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const messageId = request.params.id;

  if (!messageId) {
    throw new AppError("MESSAGE_ID_REQUIRED", "메시지 정보를 찾을 수 없어요.", 400);
  }

  response.json(await deleteMessageFromMailbox(request.user.id, messageId));
});

export const bulkDeleteMessagesFromMailboxController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const messageIds = Array.isArray(request.body?.messageIds)
    ? request.body.messageIds.filter((value: unknown): value is string => typeof value === "string")
    : [];

  if (messageIds.length === 0) {
    throw new AppError("MESSAGE_IDS_REQUIRED", "삭제할 메시지를 선택해 주세요.", 400);
  }

  response.json(await bulkDeleteMessagesFromMailbox(request.user.id, messageIds));
});

export const archiveReceivedMessageController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const messageId = request.params.id;

  if (!messageId) {
    throw new AppError("MESSAGE_ID_REQUIRED", "메시지 정보를 찾을 수 없어요.", 400);
  }

  response.json(await archiveReceivedMessage(request.user.id, messageId));
});

export const unarchiveReceivedMessageController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const messageId = request.params.id;

  if (!messageId) {
    throw new AppError("MESSAGE_ID_REQUIRED", "메시지 정보를 찾을 수 없어요.", 400);
  }

  response.json(await unarchiveReceivedMessage(request.user.id, messageId));
});

export const reportMessageController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const messageId = request.params.id;

  if (!messageId) {
    throw new AppError("MESSAGE_ID_REQUIRED", "메시지 정보를 찾을 수 없어요.", 400);
  }

  response.status(201).json(
    await reportMessage(request.user.id, messageId, {
      reason: typeof request.body?.reason === "string" ? request.body.reason : "",
      details: typeof request.body?.details === "string" ? request.body.details : null,
    }),
  );
});
