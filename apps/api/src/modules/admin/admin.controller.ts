import type { Request, Response } from "express";
import { AppError } from "../../lib/app-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import {
  getAdminOverview,
  hideAdminReply,
  listAdminModerationLogs,
  listAdminNotificationLogs,
  listAdminReports,
  listAdminReplies,
  reviewAdminReport,
  suspendAdminUser,
  unsuspendAdminUser,
} from "./admin.service.js";

export const getAdminOverviewController = asyncHandler(async (_request: Request, response: Response) => {
  response.json({ overview: await getAdminOverview() });
});

export const listAdminModerationLogsController = asyncHandler(async (_request: Request, response: Response) => {
  response.json({ logs: await listAdminModerationLogs() });
});

export const listAdminNotificationLogsController = asyncHandler(async (_request: Request, response: Response) => {
  response.json({ logs: await listAdminNotificationLogs() });
});

export const listAdminRepliesController = asyncHandler(async (_request: Request, response: Response) => {
  response.json({ replies: await listAdminReplies() });
});

export const listAdminReportsController = asyncHandler(async (_request: Request, response: Response) => {
  response.json({ reports: await listAdminReports() });
});

export const hideAdminReplyController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.params.id) {
    throw new AppError("REPLY_ID_REQUIRED", "답장 정보를 찾을 수 없어요.", 400);
  }

  response.json(
    await hideAdminReply(
      request.params.id,
      typeof request.body?.reason === "string" ? request.body.reason : undefined,
    ),
  );
});

export const reviewAdminReportController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.params.id) {
    throw new AppError("REPORT_ID_REQUIRED", "신고 정보를 찾을 수 없어요.", 400);
  }

  response.json(
    await reviewAdminReport(request.params.id, {
      status: request.body?.status === "DISMISSED" ? "DISMISSED" : "REVIEWED",
      note: typeof request.body?.note === "string" ? request.body.note : null,
    }),
  );
});

export const suspendAdminUserController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.params.id) {
    throw new AppError("USER_ID_REQUIRED", "사용자 정보를 찾을 수 없어요.", 400);
  }

  response.json(
    await suspendAdminUser(request.params.id, typeof request.body?.reason === "string" ? request.body.reason : null),
  );
});

export const unsuspendAdminUserController = asyncHandler(async (request: Request, response: Response) => {
  if (!request.params.id) {
    throw new AppError("USER_ID_REQUIRED", "사용자 정보를 찾을 수 없어요.", 400);
  }

  response.json(await unsuspendAdminUser(request.params.id));
});
