import type { Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { createPublicMessageReply, createPublicMessageReport, getPublicMessage } from "./public-message.service.js";

export const getPublicMessageController = asyncHandler(async (request: Request, response: Response) => {
  const token = request.params.token;

  if (!token) {
    response.status(400).json({
      error: {
        code: "MESSAGE_TOKEN_REQUIRED",
        message: "도착한 마음의 링크 정보를 찾을 수 없어요.",
      },
    });
    return;
  }

  response.json({ message: await getPublicMessage(token) });
});

export const createPublicMessageReplyController = asyncHandler(async (request: Request, response: Response) => {
  const token = request.params.token;

  if (!token) {
    response.status(400).json({
      error: {
        code: "MESSAGE_TOKEN_REQUIRED",
        message: "도착한 마음의 링크 정보를 찾을 수 없어요.",
      },
    });
    return;
  }

  response.status(201).json(
    await createPublicMessageReply(token, {
      content: typeof request.body?.content === "string" ? request.body.content : "",
      senderDisplayName: typeof request.body?.senderDisplayName === "string" ? request.body.senderDisplayName : null,
      isAnonymous: typeof request.body?.isAnonymous === "boolean" ? request.body.isAnonymous : true,
    }),
  );
});

export const createPublicMessageReportController = asyncHandler(async (request: Request, response: Response) => {
  const token = request.params.token;

  if (!token) {
    response.status(400).json({
      error: {
        code: "MESSAGE_TOKEN_REQUIRED",
        message: "도착한 마음의 링크 정보를 찾을 수 없어요.",
      },
    });
    return;
  }

  response.status(201).json(
    await createPublicMessageReport(token, {
      reason: typeof request.body?.reason === "string" ? request.body.reason : "",
      details: typeof request.body?.details === "string" ? request.body.details : null,
    }),
  );
});
