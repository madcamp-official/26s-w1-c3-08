import type { Request, Response } from "express";
import { AppError } from "../../lib/app-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { getEmotionReport } from "./report.service.js";

export const getEmotionReportController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const month = typeof request.query.month === "string" ? request.query.month : undefined;
  response.json({ report: await getEmotionReport(request.user.id, month) });
});
