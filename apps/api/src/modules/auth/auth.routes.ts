import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { getMe, kakaoCallback, linkMessage, logout, startKakaoLogin } from "./auth.controller.js";

export const authRoutes = Router();

authRoutes.get("/auth/kakao", startKakaoLogin);
authRoutes.get("/auth/kakao/callback", kakaoCallback);
authRoutes.get("/me", authMiddleware, getMe);
authRoutes.post("/auth/logout", authMiddleware, logout);
authRoutes.post("/auth/link-message", authMiddleware, linkMessage);
