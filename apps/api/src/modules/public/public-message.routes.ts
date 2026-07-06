import { Router } from "express";
import {
  createNotificationSuppressionController,
  deleteNotificationSuppressionController,
} from "./notification-suppression.controller.js";
import {
  createPublicMessageReplyController,
  createPublicMessageReportController,
  getPublicMessageController,
} from "./public-message.controller.js";

export const publicMessageRoutes = Router();

publicMessageRoutes.get("/public/messages/:token", getPublicMessageController);
publicMessageRoutes.post("/public/messages/:token/replies", createPublicMessageReplyController);
publicMessageRoutes.post("/public/messages/:token/reports", createPublicMessageReportController);
publicMessageRoutes.post("/public/notification-suppressions", createNotificationSuppressionController);
publicMessageRoutes.delete("/public/notification-suppressions", deleteNotificationSuppressionController);
