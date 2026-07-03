import type { Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { getPublicMessage } from "./public-message.service.js";

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
