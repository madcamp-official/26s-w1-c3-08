import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config/env.js";
import { AppError } from "../lib/app-error.js";
import { prisma } from "../lib/prisma.js";

export const AUTH_COOKIE_NAME = "maeari_session";

type SessionPayload = {
  sub: string;
};

export async function authMiddleware(request: Request, _response: Response, next: NextFunction) {
  try {
    const token = request.cookies?.[AUTH_COOKIE_NAME];

    if (!token) {
      throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
    }

    const payload = jwt.verify(token, config.jwtSecret) as SessionPayload;
    const user = await prisma.user.findFirst({
      where: {
        id: payload.sub,
        deletedAt: null,
      },
      select: {
        id: true,
        kakaoId: true,
        nickname: true,
        email: true,
        friendCode: true,
        onboardingNote: true,
        suspendedAt: true,
      },
    });

    if (!user) {
      throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
    }

    if (user.suspendedAt) {
      throw new AppError("ACCOUNT_SUSPENDED", "운영 정책에 따라 이용이 제한된 계정입니다.", 403);
    }

    request.user = {
      ...user,
      isAdmin: config.adminKakaoIds.includes(user.kakaoId),
    };
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401));
  }
}

export function createSessionToken(userId: string) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: "14d" });
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax" as const,
    domain: config.cookieDomain,
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 14,
  };
}
