import { Router } from "express";
import { createNotificationSuppressionController } from "./notification-suppression.controller.js";
import { getPublicMessageController } from "./public-message.controller.js";

export const publicMessageRoutes = Router();

publicMessageRoutes.get("/public/messages/:token", getPublicMessageController);
publicMessageRoutes.post("/public/notification-suppressions", createNotificationSuppressionController);
