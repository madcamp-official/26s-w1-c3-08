import { Router } from "express";
import { adminMiddleware } from "../../middlewares/admin.middleware.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  getAdminOverviewController,
  hideAdminReplyController,
  listAdminReportsController,
  listAdminModerationLogsController,
  listAdminNotificationLogsController,
  listAdminRepliesController,
  reviewAdminReportController,
  suspendAdminUserController,
  unsuspendAdminUserController,
} from "./admin.controller.js";

export const adminRoutes = Router();

adminRoutes.use("/admin", authMiddleware, adminMiddleware);
adminRoutes.get("/admin/overview", getAdminOverviewController);
adminRoutes.get("/admin/moderation-logs", listAdminModerationLogsController);
adminRoutes.get("/admin/notification-logs", listAdminNotificationLogsController);
adminRoutes.get("/admin/replies", listAdminRepliesController);
adminRoutes.get("/admin/reports", listAdminReportsController);
adminRoutes.patch("/admin/replies/:id/hide", hideAdminReplyController);
adminRoutes.patch("/admin/reports/:id/review", reviewAdminReportController);
adminRoutes.patch("/admin/users/:id/suspend", suspendAdminUserController);
adminRoutes.patch("/admin/users/:id/unsuspend", unsuspendAdminUserController);
