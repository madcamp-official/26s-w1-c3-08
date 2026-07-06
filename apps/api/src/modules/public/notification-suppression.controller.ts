import type { Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import {
  createNotificationSuppression,
  deleteNotificationSuppression,
} from "./notification-suppression.service.js";
import {
  createNotificationSuppressionSchema,
  deleteNotificationSuppressionSchema,
} from "./notification-suppression.validation.js";

export const createNotificationSuppressionController = asyncHandler(async (request: Request, response: Response) => {
  const input = createNotificationSuppressionSchema.parse(request.body);
  response.status(201).json(await createNotificationSuppression(input));
});

export const deleteNotificationSuppressionController = asyncHandler(async (request: Request, response: Response) => {
  const input = deleteNotificationSuppressionSchema.parse(request.body);
  response.json(await deleteNotificationSuppression(input));
});
