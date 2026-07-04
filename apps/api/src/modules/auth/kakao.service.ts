import crypto from "node:crypto";
import { config } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";

type KakaoTokenResponse = {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type KakaoProfileResponse = {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
  properties?: {
    nickname?: string;
    profile_image?: string;
  };
};

export function createKakaoAuthorizationUrl(state: string) {
  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.kakaoClientId);
  url.searchParams.set("redirect_uri", config.kakaoRedirectUri);
  url.searchParams.set("state", state);

  return url.toString();
}

export function createOAuthState() {
  return crypto.randomBytes(24).toString("base64url");
}

export async function exchangeKakaoCode(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.kakaoClientId,
    client_secret: config.kakaoClientSecret,
    redirect_uri: config.kakaoRedirectUri,
    code,
  });

  const response = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body,
  });

  if (!response.ok) {
    throw new AppError("KAKAO_TOKEN_EXCHANGE_FAILED", "카카오 로그인 정보를 확인하지 못했어요.", 502);
  }

  return (await response.json()) as KakaoTokenResponse;
}

export async function fetchKakaoProfile(accessToken: string) {
  const response = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
  });

  if (!response.ok) {
    throw new AppError("KAKAO_PROFILE_FAILED", "카카오 사용자 정보를 가져오지 못했어요.", 502);
  }

  const profile = (await response.json()) as KakaoProfileResponse;
  const nickname =
    profile.kakao_account?.profile?.nickname ??
    profile.properties?.nickname ??
    "매아리 사용자";

  return {
    kakaoId: String(profile.id),
    nickname,
    email: profile.kakao_account?.email,
    profileImageUrl:
      profile.kakao_account?.profile?.profile_image_url ?? profile.properties?.profile_image,
  };
}
