"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import { Notice } from "@/components/Notice";

const PENDING_TOKEN_KEY = "maeari.pendingArrivalToken";
const PENDING_FRIEND_INVITE_TOKEN_KEY = "maeari.pendingFriendInviteToken";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("로그인 상태를 확인하고 있어요.");
  const [errorFallbackHref, setErrorFallbackHref] = useState("/arrival/link-failed");

  const finishAuth = useCallback(async () => {
    setError(null);

    const token = sessionStorage.getItem(PENDING_TOKEN_KEY);
    const friendInviteToken = sessionStorage.getItem(PENDING_FRIEND_INVITE_TOKEN_KEY);

    if (!token) {
      if (friendInviteToken) {
        setStatusText("친구 연결을 마무리하고 있어요.");
        setErrorFallbackHref("/friends");

        try {
          await apiFetch(`/friends/invites/${encodeURIComponent(friendInviteToken)}/claim`, { method: "POST" });
          sessionStorage.removeItem(PENDING_FRIEND_INVITE_TOKEN_KEY);
          router.replace("/friends");
        } catch (caught) {
          if (caught instanceof ApiError) {
            setError(caught.message);
            return;
          }

          setError("친구로 연결하지 못했어요.");
        }

        return;
      }

      try {
        const response = await apiFetch<{ user: { onboardingNote?: string | null } }>("/me");
        const completedOnboarding =
          response.user.onboardingNote !== null && typeof response.user.onboardingNote !== "undefined";

        router.replace(completedOnboarding ? "/write" : "/onboarding");
      } catch {
        router.replace("/write");
      }
      return;
    }

    try {
      setStatusText("도착한 마음을 보관하고 있어요.");
      setErrorFallbackHref("/arrival/link-failed");
      await apiFetch<{ linked: boolean; redirectTo: string }>("/auth/link-message", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      sessionStorage.removeItem(PENDING_TOKEN_KEY);
      router.replace("/inbox");
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        return;
      }

      setError("도착한 마음을 보관하지 못했어요.");
    }
  }, [router]);

  useEffect(() => {
    void finishAuth();
  }, [finishAuth]);

  return (
    <main className="min-h-screen bg-[#FBF9FC] text-[#4E536B]">
      <header className="h-[74px] border-b border-[#F1EEF8] bg-white px-5">
        <div className="flex h-full items-center">
          <Image
            src="/images/maeari-app-icon.png"
            alt="매아리"
            width={42}
            height={42}
            className="h-[42px] w-[42px] rounded-[10px] object-cover shadow-[0_6px_14px_rgba(109,72,219,0.14)]"
            priority
          />
          <span className="ml-3 text-[25px] font-medium tracking-[0.02em] text-[#9A85E1]">매아리</span>
        </div>
      </header>

      <section className="figma-panel mx-auto mt-[31px] w-[calc(100%-32px)] max-w-md p-6 text-center">
        {error ? (
          <div className="space-y-4">
            <Notice title={error} tone="danger" />
            <button
              type="button"
              onClick={() => void finishAuth()}
              className="focus-ring rounded-lg border border-[#DAD4E8] px-4 py-2 text-sm font-semibold"
            >
              다시 시도
            </button>
            <button
              type="button"
              onClick={() => router.replace(errorFallbackHref)}
              className="focus-ring rounded-lg bg-[#6D48DB] px-4 py-2 text-sm font-semibold text-white"
            >
              확인
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-brand-accent" />
            <p className="text-sm font-medium text-[#6E738A]">{statusText}</p>
          </div>
        )}
      </section>
    </main>
  );
}
