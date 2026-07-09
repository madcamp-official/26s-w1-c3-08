import type { Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import {
  cancelMessage,
  archiveReceivedMessage,
  bulkDeleteMessagesFromMailbox,
  createAuthenticatedMessageReply,
  createMessagePublicLink,
  createMessage,
  deleteMessageFromMailbox,
  deleteSentReply,
  getMessageDetail,
  listArchivedMessages,
  listAuthoredMessageReplies,
  listReceivedMessageReplies,
  listReceivedMessages,
  listSentMessageReplies,
  listSentMessages,
  markSentReplyRead,
  reportMessage,
  unarchiveReceivedMessage,
} from "./message.service.js";
import { listRecipientHistory } from "./recipient-history.service.js";
import type { MessageMailboxDeleteScope } from "./message.service.js";

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

export const listRecipientHistoryController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json(await listRecipientHistory(request.user.id));
});

export const listSentMessageRepliesController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json({ replies: await listSentMessageReplies(request.user.id) });
});

export const listAuthoredMessageRepliesController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json({ replies: await listAuthoredMessageReplies(request.user.id) });
});

export const listReceivedMessageRepliesController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json({ replies: await listReceivedMessageReplies(request.user.id) });
});

export const createAuthenticatedMessageReplyController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const messageId = request.params.id;

  if (!messageId) {
    throw new AppError("MESSAGE_ID_REQUIRED", "메시지 정보를 찾을 수 없어요.", 400);
  }

  response.status(201).json(await createAuthenticatedMessageReply(request.user.id, messageId, request.body));
});

export const markSentReplyReadController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const replyId = request.params.id;

  if (!replyId) {
    throw new AppError("MESSAGE_REPLY_ID_REQUIRED", "답장 정보를 찾을 수 없어요.", 400);
  }

  response.json(await markSentReplyRead(request.user.id, replyId));
});

export const deleteSentReplyController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const replyId = request.params.id;

  if (!replyId) {
    throw new AppError("MESSAGE_REPLY_ID_REQUIRED", "답장 정보를 찾을 수 없어요.", 400);
  }

  response.json(await deleteSentReply(request.user.id, replyId));
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

  response.json(
    await deleteMessageFromMailbox(
      request.user.id,
      messageId,
      resolveMessageMailboxDeleteScope(request, request.query.scope),
    ),
  );
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

  response.json(
    await bulkDeleteMessagesFromMailbox(
      request.user.id,
      messageIds,
      resolveMessageMailboxDeleteScope(request, request.body?.scope),
    ),
  );
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

function resolveMessageMailboxDeleteScope(request: Request, explicitScope: unknown): MessageMailboxDeleteScope {
  const parsedScope = parseMessageMailboxDeleteScope(explicitScope);

  if (parsedScope) {
    return parsedScope;
  }

  if (explicitScope !== undefined) {
    throw new AppError("MESSAGE_DELETE_SCOPE_INVALID", "삭제 범위가 올바르지 않아요.", 400);
  }

  return resolveMessageMailboxDeleteScopeFromReferer(request.get("referer")) ?? "auto";
}

function parseMessageMailboxDeleteScope(value: unknown): MessageMailboxDeleteScope | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "sender" || normalized === "recipient" || normalized === "auto") {
    return normalized;
  }

  return null;
}

function resolveMessageMailboxDeleteScopeFromReferer(referer?: string) {
  if (!referer) {
    return null;
  }

  try {
    const pathname = new URL(referer, "http://localhost").pathname;

    if (
      pathname === "/archive" ||
      pathname.startsWith("/archive/") ||
      pathname === "/inbox" ||
      pathname.startsWith("/inbox/")
    ) {
      return "recipient" as const;
    }

    if (pathname === "/sent" || pathname.startsWith("/sent/")) {
      return "sender" as const;
    }
  } catch {
    return null;
  }

  return null;
}
