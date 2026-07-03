import type { Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import {
  cancelMessage,
  createMessage,
  getMessageDetail,
  listReceivedMessages,
  listSentMessages,
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
