import type { Request, Response } from "express";
import { config } from "../../config/env.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import {
  AUTH_COOKIE_NAME,
  createSessionToken,
  getAuthCookieOptions,
} from "../../middlewares/auth.middleware.js";
import {
  createKakaoAuthorizationUrl,
  createOAuthState,
  exchangeKakaoCode,
  fetchKakaoProfile,
} from "./kakao.service.js";
import { linkMessageToUser } from "./link-message.service.js";

const OAUTH_STATE_COOKIE = "maeum_oauth_state";

export const startKakaoLogin = asyncHandler(async (_request: Request, response: Response) => {
  const state = createOAuthState();

  response.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax",
    domain: config.cookieDomain,
    path: "/",
    maxAge: 1000 * 60 * 10,
  });

  response.redirect(createKakaoAuthorizationUrl(state));
});

export const kakaoCallback = asyncHandler(async (request: Request, response: Response) => {
  const code = typeof request.query.code === "string" ? request.query.code : undefined;
  const state = typeof request.query.state === "string" ? request.query.state : undefined;
  const savedState = request.cookies?.[OAUTH_STATE_COOKIE];

  if (!code || !state || !savedState || state !== savedState) {
    throw new AppError("INVALID_OAUTH_STATE", "카카오 로그인 요청이 올바르지 않아요.", 400);
  }

  const token = await exchangeKakaoCode(code);
  const kakaoProfile = await fetchKakaoProfile(token.access_token);

  const user = await prisma.user.upsert({
    where: { kakaoId: kakaoProfile.kakaoId },
    create: {
      kakaoId: kakaoProfile.kakaoId,
      nickname: kakaoProfile.nickname,
      email: kakaoProfile.email,
      profileImageUrl: kakaoProfile.profileImageUrl,
      lastLoginAt: new Date(),
    },
    update: {
      nickname: kakaoProfile.nickname,
      email: kakaoProfile.email,
      profileImageUrl: kakaoProfile.profileImageUrl,
      lastLoginAt: new Date(),
    },
    select: { id: true },
  });

  response.clearCookie(OAUTH_STATE_COOKIE, { domain: config.cookieDomain, path: "/" });
  response.cookie(AUTH_COOKIE_NAME, createSessionToken(user.id), getAuthCookieOptions());
  response.redirect(`${config.webOrigin}/auth/callback`);
});

export const getMe = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json({ user: request.user });
});

export const logout = asyncHandler(async (_request: Request, response: Response) => {
  response.clearCookie(AUTH_COOKIE_NAME, {
    domain: config.cookieDomain,
    path: "/",
  });
  response.status(204).send();
});

export const linkMessage = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const token = typeof request.body?.token === "string" ? request.body.token : "";
  const linked = await linkMessageToUser({ token, userId: request.user.id });

  response.json(linked);
});
