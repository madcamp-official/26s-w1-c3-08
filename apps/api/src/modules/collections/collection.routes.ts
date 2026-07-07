import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import {
  cancelMessageCollectionController,
  createMessageCollectionController,
  createPublicMessageCollectionSubmissionController,
  getMessageCollectionController,
  getPublicMessageCollectionController,
  listMessageCollectionsController,
} from "./collection.controller.js";
import {
  createMessageCollectionSchema,
  createMessageCollectionSubmissionSchema,
} from "./collection.validation.js";

export const collectionRoutes = Router();

collectionRoutes.post(
  "/message-collections",
  authMiddleware,
  validateBody(createMessageCollectionSchema),
  createMessageCollectionController,
);
collectionRoutes.get("/message-collections", authMiddleware, listMessageCollectionsController);
collectionRoutes.get("/message-collections/:id", authMiddleware, getMessageCollectionController);
collectionRoutes.delete("/message-collections/:id", authMiddleware, cancelMessageCollectionController);
collectionRoutes.get("/public/message-collections/:token", getPublicMessageCollectionController);
collectionRoutes.post(
  "/public/message-collections/:token/submissions",
  validateBody(createMessageCollectionSubmissionSchema),
  createPublicMessageCollectionSubmissionController,
);
