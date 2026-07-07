import { Router } from "express";
import { getDailyLineController } from "./daily-line.controller.js";

export const dailyLineRoutes = Router();

dailyLineRoutes.get("/daily-line", getDailyLineController);
