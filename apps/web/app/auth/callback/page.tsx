"use client";

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
    <main className="grid min-h-screen place-items-center px-4">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 text-center shadow-soft">
        {error ? (
          <div className="space-y-4">
            <Notice title={error} tone="danger" />
            <button
              type="button"
              onClick={() => void finishAuth()}
              className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            >
              다시 시도
            </button>
            <button
              type="button"
              onClick={() => router.replace(errorFallbackHref)}
              className="focus-ring rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
            >
              확인
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-petal" />
            <p className="text-sm font-medium text-slate-700">{statusText}</p>
          </div>
        )}
      </section>
    </main>
  );
}
