import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import {
  archiveReceivedMessageController,
  bulkDeleteMessagesFromMailboxController,
  cancelMessageController,
  createMessagePublicLinkController,
  createMessageController,
  deleteMessageFromMailboxController,
  getMessageDetailController,
  listArchivedMessagesController,
  listReceivedMessagesController,
  listSentMessagesController,
  reportMessageController,
  unarchiveReceivedMessageController,
} from "./message.controller.js";
import { createMessageSchema } from "./message.validation.js";
import { parseCreateMessageRequest } from "./message-upload.middleware.js";

export const messageRoutes = Router();

messageRoutes.post(
  "/messages",
  authMiddleware,
  parseCreateMessageRequest,
  validateBody(createMessageSchema),
  createMessageController,
);
messageRoutes.get("/messages/sent", authMiddleware, listSentMessagesController);
messageRoutes.get("/messages/received", authMiddleware, listReceivedMessagesController);
messageRoutes.get("/messages/archived", authMiddleware, listArchivedMessagesController);
messageRoutes.post("/messages/bulk-delete", authMiddleware, bulkDeleteMessagesFromMailboxController);
messageRoutes.get("/messages/:id", authMiddleware, getMessageDetailController);
messageRoutes.post("/messages/:id/public-link", authMiddleware, createMessagePublicLinkController);
messageRoutes.patch("/messages/:id/cancel", authMiddleware, cancelMessageController);
messageRoutes.patch("/messages/:id/archive", authMiddleware, archiveReceivedMessageController);
messageRoutes.patch("/messages/:id/unarchive", authMiddleware, unarchiveReceivedMessageController);
messageRoutes.post("/messages/:id/reports", authMiddleware, reportMessageController);
messageRoutes.delete("/messages/:id", authMiddleware, deleteMessageFromMailboxController);
