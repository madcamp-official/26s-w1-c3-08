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
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-soft">
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Loader2 className="animate-spin text-petal" />
            <p className="text-sm font-medium text-slate-700">친구 초대 링크를 확인하고 있어요.</p>
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-md bg-[#fbf7ff]">
                <Image src="/images/maeari-mark.png" alt="" fill sizes="48px" className="object-cover" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-ink">친구 초대</h1>
                <p className="mt-1 text-sm text-slate-500">매아리에서 친구로 연결돼요.</p>
              </div>
            </div>

            {notice ? <Notice title={notice.title} body={notice.body} tone={notice.tone} /> : null}

            {preview ? (
              <div className="rounded-md bg-slate-50 p-4">
                <p className="text-sm text-slate-500">초대한 사람</p>
                <p className="mt-1 text-lg font-semibold text-ink">{preview.invite.inviter.nickname}</p>
                <p className="mt-3 text-sm text-slate-500">{formatDateTime(preview.invite.expiresAt)}까지 유효</p>
              </div>
            ) : null}

            {preview?.availability.available ? (
              <button
                type="button"
                onClick={() => void claimInvite()}
                disabled={claiming}
                className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-md bg-petal px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
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
              className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
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
