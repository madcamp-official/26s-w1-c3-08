import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  getNotificationSummaryController,
  listNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController,
} from "./notification.controller.js";

export const notificationRoutes = Router();

notificationRoutes.use("/notifications", authMiddleware);
notificationRoutes.get("/notifications/summary", getNotificationSummaryController);
notificationRoutes.get("/notifications", listNotificationsController);
notificationRoutes.patch("/notifications/read-all", markAllNotificationsReadController);
notificationRoutes.patch("/notifications/:id/read", markNotificationReadController);
