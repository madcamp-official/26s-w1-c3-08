import type { Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { createNotificationSuppression } from "./notification-suppression.service.js";
import { createNotificationSuppressionSchema } from "./notification-suppression.validation.js";

export const createNotificationSuppressionController = asyncHandler(async (request: Request, response: Response) => {
  const input = createNotificationSuppressionSchema.parse(request.body);
  response.status(201).json(await createNotificationSuppression(input));
});
