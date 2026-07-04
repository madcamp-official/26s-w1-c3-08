import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import {
  cancelMessageController,
  createMessagePublicLinkController,
  createMessageController,
  deleteMessageFromMailboxController,
  getMessageDetailController,
  listReceivedMessagesController,
  listSentMessagesController,
} from "./message.controller.js";
import { createMessageSchema } from "./message.validation.js";

export const messageRoutes = Router();

messageRoutes.post("/messages", authMiddleware, validateBody(createMessageSchema), createMessageController);
messageRoutes.get("/messages/sent", authMiddleware, listSentMessagesController);
messageRoutes.get("/messages/received", authMiddleware, listReceivedMessagesController);
messageRoutes.get("/messages/:id", authMiddleware, getMessageDetailController);
messageRoutes.post("/messages/:id/public-link", authMiddleware, createMessagePublicLinkController);
messageRoutes.patch("/messages/:id/cancel", authMiddleware, cancelMessageController);
messageRoutes.delete("/messages/:id", authMiddleware, deleteMessageFromMailboxController);
