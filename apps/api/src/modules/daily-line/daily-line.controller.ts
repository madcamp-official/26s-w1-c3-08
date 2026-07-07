import type { Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { getTodayDailyLine } from "./daily-line.service.js";

export const getDailyLineController = asyncHandler(async (_request: Request, response: Response) => {
  response.json({ dailyLine: await getTodayDailyLine() });
});
