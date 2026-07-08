import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  createCommunicationBlockController,
  deleteCommunicationBlockController,
  listCommunicationBlocksController,
} from "./communication-block.controller.js";

export const communicationBlockRoutes = Router();

communicationBlockRoutes.get("/me/communication-blocks", authMiddleware, listCommunicationBlocksController);
communicationBlockRoutes.post("/me/communication-blocks", authMiddleware, createCommunicationBlockController);
communicationBlockRoutes.delete("/me/communication-blocks/:id", authMiddleware, deleteCommunicationBlockController);
