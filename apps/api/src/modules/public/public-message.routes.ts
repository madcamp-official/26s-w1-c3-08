import { Router } from "express";
import { getPublicMessageController } from "./public-message.controller.js";

export const publicMessageRoutes = Router();

publicMessageRoutes.get("/public/messages/:token", getPublicMessageController);
