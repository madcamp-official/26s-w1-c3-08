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
import { createUniqueFriendCode } from "../friends/friend-code.js";

const OAUTH_STATE_COOKIE = "maeari_oauth_state";
const OAUTH_RETURN_ORIGIN_COOKIE = "maeari_oauth_return_origin";

export const startKakaoLogin = asyncHandler(async (request: Request, response: Response) => {
  const state = createOAuthState();
  const returnOrigin = getRequestOrigin(request);

  response.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax",
    domain: config.cookieDomain,
    path: "/",
    maxAge: 1000 * 60 * 10,
  });
  response.cookie(OAUTH_RETURN_ORIGIN_COOKIE, returnOrigin, {
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
  const returnOrigin = getSafeReturnOrigin(request.cookies?.[OAUTH_RETURN_ORIGIN_COOKIE]);

  if (!code || !state || !savedState || state !== savedState) {
    throw new AppError("INVALID_OAUTH_STATE", "카카오 로그인 요청이 올바르지 않아요.", 400);
  }

  const token = await exchangeKakaoCode(code);
  const kakaoProfile = await fetchKakaoProfile(token.access_token);
  const friendCode = await createUniqueFriendCode();

  const user = await prisma.user.upsert({
    where: { kakaoId: kakaoProfile.kakaoId },
    create: {
      kakaoId: kakaoProfile.kakaoId,
      nickname: kakaoProfile.nickname,
      email: kakaoProfile.email,
      friendCode,
      profileImageUrl: kakaoProfile.profileImageUrl,
      lastLoginAt: new Date(),
    },
    update: {
      nickname: kakaoProfile.nickname,
      email: kakaoProfile.email,
      profileImageUrl: kakaoProfile.profileImageUrl,
      lastLoginAt: new Date(),
    },
    select: { id: true, friendCode: true },
  });

  if (!user.friendCode) {
    await prisma.user.update({
      where: { id: user.id },
      data: { friendCode: await createUniqueFriendCode() },
    });
  }

  response.clearCookie(OAUTH_STATE_COOKIE, { domain: config.cookieDomain, path: "/" });
  response.clearCookie(OAUTH_RETURN_ORIGIN_COOKIE, { domain: config.cookieDomain, path: "/" });
  response.cookie(AUTH_COOKIE_NAME, createSessionToken(user.id), getAuthCookieOptions());
  response.redirect(`${returnOrigin}/auth/callback`);
});

export const getMe = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  response.json({ user: request.user });
});

export const updateOnboardingNote = asyncHandler(async (request: Request, response: Response) => {
  if (!request.user) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  const note = typeof request.body?.note === "string" ? request.body.note.trim() : "";

  if (note.length > 1000) {
    throw new AppError("ONBOARDING_NOTE_TOO_LONG", "온보딩 답변은 1000자 이하로 적어 주세요.", 400);
  }

  const user = await prisma.user.update({
    where: { id: request.user.id },
    data: {
      onboardingNote: note,
    },
    select: {
      id: true,
      kakaoId: true,
      nickname: true,
      email: true,
      friendCode: true,
      onboardingNote: true,
    },
  });

  response.json({ user });
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

function getRequestOrigin(request: Request) {
  const origin = request.get("origin");

  if (origin && isAllowedOrigin(origin)) {
    return origin;
  }

  const referer = request.get("referer");

  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;

      if (isAllowedOrigin(refererOrigin)) {
        return refererOrigin;
      }
    } catch {
      return config.webOrigin;
    }
  }

  return config.webOrigin;
}

function getSafeReturnOrigin(value: unknown) {
  if (typeof value === "string" && isAllowedOrigin(value)) {
    return value;
  }

  return config.webOrigin;
}

function isAllowedOrigin(origin: string) {
  try {
    const parsed = new URL(origin);
    const configured = new URL(config.webOrigin);
    const kakaoRedirect = new URL(config.kakaoRedirectUri);

    if (parsed.origin === configured.origin || parsed.origin === kakaoRedirect.origin) {
      return true;
    }

    return parsed.protocol === "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1";
  } catch {
    return false;
  }
}
