"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, UserPlus } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import { Notice } from "@/components/Notice";
import { formatDateTime } from "@/lib/format";

const PENDING_FRIEND_INVITE_TOKEN_KEY = "maeari.pendingFriendInviteToken";

type FriendInvitePreview = {
  invite: {
    id: string;
    expiresAt: string;
    inviter: {
      id: string;
      nickname: string;
      profileImageUrl?: string | null;
    };
  };
  availability: {
    available: boolean;
    reason?: string | null;
  };
};

export default function FriendInvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = useMemo(() => {
    const value = params.token;
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  }, [params.token]);
  const [preview, setPreview] = useState<FriendInvitePreview | null>(null);
  const [notice, setNotice] = useState<{ title: string; body?: string; tone?: "danger" | "success" | "default" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const autoClaimAttemptedRef = useRef(false);

  useEffect(() => {
    async function loadPreview() {
      setLoading(true);
      setNotice(null);

      try {
        const response = await apiFetch<FriendInvitePreview>(`/friends/invites/${encodeURIComponent(token)}/preview`);
        setPreview(response);
      } catch (caught) {
        setNotice({
          title: caught instanceof ApiError ? caught.message : "친구 초대 링크를 확인하지 못했어요.",
          tone: "danger",
        });
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      void loadPreview();
    }
  }, [token]);

  useEffect(() => {
    if (!preview?.availability.available || autoClaimAttemptedRef.current) {
      return;
    }

    autoClaimAttemptedRef.current = true;
    void claimInvite();
  }, [preview]);

  async function claimInvite() {
    setClaiming(true);
    setNotice(null);

    try {
      await apiFetch(`/friends/invites/${encodeURIComponent(token)}/claim`, { method: "POST" });
      sessionStorage.removeItem(PENDING_FRIEND_INVITE_TOKEN_KEY);
      setNotice({ title: "친구로 연결됐어요.", body: "친구 목록으로 이동합니다.", tone: "success" });
      window.setTimeout(() => router.replace("/friends"), 500);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        sessionStorage.setItem(PENDING_FRIEND_INVITE_TOKEN_KEY, token);
        router.push("/login");
        return;
      }

      setNotice({
        title: caught instanceof ApiError ? caught.message : "친구로 연결하지 못했어요.",
        tone: "danger",
      });
    } finally {
      setClaiming(false);
    }
  }

  const unavailableMessage = getUnavailableMessage(preview?.availability.reason);

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

      <section className="figma-panel mx-auto mt-[31px] w-[calc(100%-32px)] max-w-md p-6">
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Loader2 className="animate-spin text-brand-accent" />
            <p className="text-sm font-medium text-[#6E738A]">친구 초대 링크를 확인하고 있어요.</p>
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-[#fbf7ff]">
                <Image src="/images/maeari-app-icon.png" alt="" fill sizes="48px" className="object-cover" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#4E536B]">친구 초대</h1>
                <p className="mt-1 text-sm text-[#A2A6BF]">매아리에서 친구로 연결돼요.</p>
              </div>
            </div>

            {notice ? <Notice title={notice.title} body={notice.body} tone={notice.tone} /> : null}

            {preview ? (
              <div className="rounded-lg bg-brand-gray p-4">
                <p className="text-sm text-[#A2A6BF]">초대한 사람</p>
                <p className="mt-1 text-lg font-semibold text-[#4E536B]">{preview.invite.inviter.nickname}</p>
                <p className="mt-3 text-sm text-[#A2A6BF]">{formatDateTime(preview.invite.expiresAt)}까지 유효</p>
              </div>
            ) : null}

            {preview?.availability.available ? (
              <button
                type="button"
                onClick={() => void claimInvite()}
                disabled={claiming}
                className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                <UserPlus size={18} />
                {claiming ? "친구로 연결 중" : "다시 시도"}
              </button>
            ) : preview ? (
              <Notice title={unavailableMessage} tone="danger" />
            ) : null}

            <button
              type="button"
              onClick={() => router.replace("/friends")}
              className="focus-ring rounded-lg border border-[#DAD4E8] px-4 py-2 text-sm font-semibold text-[#6E738A]"
            >
              친구 페이지로 이동
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function getUnavailableMessage(reason?: string | null) {
  if (reason === "EXPIRED") {
    return "만료된 친구 초대 링크예요.";
  }

  if (reason === "REVOKED") {
    return "폐기된 친구 초대 링크예요.";
  }

  if (reason === "ALREADY_USED") {
    return "이미 사용된 친구 초대 링크예요.";
  }

  return "사용할 수 없는 친구 초대 링크예요.";
}
