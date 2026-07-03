"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { ApiError, apiFetch } from "@/lib/api";
import { emotionLabel, formatDateTime, statusLabel } from "@/lib/format";

type MessageDetail = {
  id: string;
  title: string;
  content: string;
  emotionTag?: string | null;
  customEmotionTag?: string | null;
  scheduledAt?: string | null;
  sentAt?: string | null;
  status: string;
  senderName?: string | null;
  isSenderHidden: boolean;
  isDateHidden: boolean;
  moderationNextRetryAt?: string | null;
  recipients?: Array<{
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    type: string;
    deliveryStatus: string;
    deliveredAt?: string | null;
    readAt?: string | null;
    hasPublicLink: boolean;
  }>;
};

export default function MessageDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [message, setMessage] = useState<MessageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; body?: string; tone?: "danger" | "success" | "default" } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const response = await apiFetch<{ message: MessageDetail }>(`/messages/${params.id}`);
      setMessage(response.message);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }
      setError(caught instanceof Error ? caught.message : "메시지를 불러오지 못했어요.");
    }
  }

  async function copyPublicLink() {
    setBusy(true);
    setNotice(null);

    try {
      const response = await apiFetch<{ publicUrl: string }>(`/messages/${params.id}/public-link`, {
        method: "POST",
      });
      const url = toBrowserPublicUrl(response.publicUrl);
      await navigator.clipboard.writeText(url);
      setNotice({ title: "공개 링크를 복사했어요.", body: url, tone: "success" });
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "공개 링크를 만들지 못했어요.",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  async function cancelMessage() {
    setBusy(true);
    setNotice(null);

    try {
      await apiFetch(`/messages/${params.id}/cancel`, { method: "PATCH" });
      setNotice({ title: "예약을 취소했어요.", tone: "success" });
      await load();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "예약을 취소하지 못했어요.",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [params.id, router]);

  return (
    <AppShell>
      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/sent" className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">
          보낸 마음
        </Link>
        <Link href="/inbox" className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">
          받은 마음
        </Link>
      </div>
      {notice ? <Notice title={notice.title} body={notice.body} tone={notice.tone} /> : null}
      {error ? <Notice title={error} tone="danger" /> : null}
      {!message && !error ? <p className="text-sm text-slate-600">불러오는 중</p> : null}
      {message ? (
        <article className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-5 flex flex-wrap gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
              {statusLabel(message.status)}
            </span>
            <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
              {emotionLabel(message.emotionTag, message.customEmotionTag)}
            </span>
            {message.isSenderHidden ? (
              <span className="rounded-md bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-800">
                발신인 숨김
              </span>
            ) : null}
            {message.isDateHidden ? (
              <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">
                도착일 숨김
              </span>
            ) : null}
          </div>
          <h1 className="text-2xl font-semibold text-ink">{message.title}</h1>
          <div className="mt-3 grid gap-1 text-sm text-slate-600">
            <p>보낸 사람: {message.senderName ?? "누군가"}</p>
            <p>예약 시간: {formatDateTime(message.scheduledAt)}</p>
            <p>도착 시간: {formatDateTime(message.sentAt)}</p>
            {message.status === "MODERATION_FAILED" ? (
              <p className="text-petal">다음 검사: {formatDateTime(message.moderationNextRetryAt)}</p>
            ) : null}
          </div>
          {message.recipients && message.recipients.length > 0 ? (
            <div className="mt-5 rounded-md border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-ink">수신자</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                {message.recipients.map((recipient) => (
                  <div key={recipient.id} className="rounded-md bg-slate-50 p-3">
                    <p>
                      {recipient.name ?? "수신자"} · {recipient.type === "SELF" ? "미래의 나" : "타인"} ·{" "}
                      {statusLabel(recipient.deliveryStatus)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {[recipient.email, recipient.phone].filter(Boolean).join(" · ") || "연락처 미입력"}
                    </p>
                    {recipient.deliveredAt ? (
                      <p className="mt-1 text-xs text-moss">수신자 도착 시간: {formatDateTime(recipient.deliveredAt)}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-8 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 leading-7 text-slate-800">
            {message.content}
          </div>
          {["PENDING", "SENT"].includes(message.status) ? (
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyPublicLink()}
                disabled={busy}
                className="focus-ring inline-flex items-center gap-2 rounded-md bg-moss px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Copy size={16} />
                공개 링크 복사
              </button>
              {message.status === "PENDING" ? (
                <button
                  type="button"
                  onClick={() => void cancelMessage()}
                  disabled={busy}
                  className="focus-ring inline-flex items-center gap-2 rounded-md border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
                >
                  <XCircle size={16} />
                  예약 취소
                </button>
              ) : null}
            </div>
          ) : null}
        </article>
      ) : null}
    </AppShell>
  );
}

function toBrowserPublicUrl(publicUrl: string) {
  try {
    const parsed = new URL(publicUrl);

    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return publicUrl;
  } catch {
    return publicUrl;
  }
}
