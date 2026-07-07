import type { Request, Response } from "express";
import { AppError } from "../../lib/app-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import {
  getNotificationSummary,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification.service.js";

export const getNotificationSummaryController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json(await getNotificationSummary(request.user.id));
});

export const listNotificationsController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json(await listNotifications(request.user.id, request.query.limit));
});

export const markNotificationReadController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const notificationId = request.params.id;

  if (!notificationId) {
    throw new AppError("NOTIFICATION_ID_REQUIRED", "알림 정보를 찾을 수 없어요.", 400);
  }

  response.json(await markNotificationRead(request.user.id, notificationId));
});

export const markAllNotificationsReadController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json(await markAllNotificationsRead(request.user.id));
});
