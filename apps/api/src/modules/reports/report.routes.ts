import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { getEmotionReportController } from "./report.controller.js";

export const reportRoutes = Router();

reportRoutes.get("/reports/emotions", authMiddleware, getEmotionReportController);
