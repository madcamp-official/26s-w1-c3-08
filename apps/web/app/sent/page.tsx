"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Link2, RefreshCw, Trash2, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { ApiError, apiFetch } from "@/lib/api";
import { emotionLabel, formatDateTime, statusLabel } from "@/lib/format";

type SentMessage = {
  id: string;
  title: string;
  emotionTag?: string | null;
  customEmotionTag?: string | null;
  scheduledAt: string;
  sentAt?: string | null;
  status: string;
  isSenderHidden: boolean;
  isDateHidden: boolean;
  moderationNextRetryAt?: string | null;
  receiver?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    type: string;
    deliveryStatus: string;
    deliveredAt?: string | null;
  } | null;
  hasPublicLink: boolean;
};

const statusFilters = [
  { value: "ALL", label: "전체" },
  { value: "PENDING", label: "예약 대기" },
  { value: "SENT", label: "도착 완료" },
  { value: "MODERATION_FAILED", label: "검사 대기" },
  { value: "BLOCKED", label: "검사 차단" },
  { value: "FAILED", label: "실패" },
  { value: "CANCELED", label: "취소" },
] as const;

export default function SentPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]["value"]>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; body?: string; tone?: "danger" | "success" | "default" } | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadMessages(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await apiFetch<{ messages: SentMessage[] }>("/messages/sent");
      setMessages(response.messages);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }
      setError(caught instanceof Error ? caught.message : "발신함을 불러오지 못했어요.");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  async function cancel(id: string) {
    setNotice(null);

    try {
      await apiFetch(`/messages/${id}/cancel`, { method: "PATCH" });
      setNotice({ title: "예약을 취소했어요.", tone: "success" });
      await loadMessages();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "예약을 취소하지 못했어요.",
        tone: "danger",
      });
    }
  }

  async function copyPublicLink(messageId: string) {
    setLinkingId(messageId);
    setNotice(null);

    try {
      const response = await apiFetch<{ publicUrl: string }>(`/messages/${messageId}/public-link`, {
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
      setLinkingId(null);
    }
  }

  async function deleteFromMailbox(id: string) {
    setDeletingId(id);
    setNotice(null);

    try {
      await apiFetch(`/messages/${id}`, { method: "DELETE" });
      setNotice({ title: "보낸 마음에서 삭제했어요.", tone: "success" });
      await loadMessages();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "보낸 마음에서 삭제하지 못했어요.",
        tone: "danger",
      });
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    void loadMessages();
    const timer = window.setInterval(() => {
      void loadMessages({ silent: true });
    }, 15000);

    return () => window.clearInterval(timer);
  }, []);

  const filteredMessages = useMemo(() => {
    if (statusFilter === "ALL") {
      return messages;
    }

    return messages.filter((message) => message.status === statusFilter);
  }, [messages, statusFilter]);

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">보낸 마음</h1>
          <p className="mt-2 text-sm text-slate-600">예약한 마음과 도착한 마음을 확인해요.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadMessages()}
          className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
        >
          <RefreshCw size={16} />
          새로고침
        </button>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatusFilter(filter.value)}
            className={`focus-ring rounded-md border px-3 py-2 text-sm font-semibold ${
              statusFilter === filter.value
                ? "border-ink bg-ink text-white"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {notice ? <Notice title={notice.title} body={notice.body} tone={notice.tone} /> : null}
      {error ? <Notice title={error} tone="danger" /> : null}
      {loading ? <p className="text-sm text-slate-600">불러오는 중</p> : null}
      {!loading && messages.length === 0 ? (
        <Notice title="아직 보낸 마음이 없어요." body="첫 마음을 남겨보세요." />
      ) : null}
      {!loading && messages.length > 0 && filteredMessages.length === 0 ? (
        <Notice title="이 상태의 마음이 없어요." />
      ) : null}
      <div className="grid gap-3">
        {filteredMessages.map((message) => (
          <article key={message.id} className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
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
                <Link href={`/messages/${message.id}`} className="focus-ring rounded-md text-lg font-semibold text-ink">
                  {message.title}
                </Link>
                <p className="mt-2 text-sm text-slate-600">
                  {message.receiver?.name ?? "수신자"} · {formatDateTime(message.scheduledAt)}
                </p>
                {message.receiver ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {[message.receiver.email, message.receiver.phone].filter(Boolean).join(" · ") || "연락처 미입력"} ·{" "}
                    {statusLabel(message.receiver.deliveryStatus)}
                  </p>
                ) : null}
                {message.status === "PENDING" ? (
                  <p className="mt-2 text-sm text-slate-500">
                    예약 시간이 지나면 보통 1분 안에 도착 완료로 바뀌어요.
                  </p>
                ) : null}
                {message.status === "SENT" && message.sentAt ? (
                  <p className="mt-2 text-sm text-moss">도착 시간: {formatDateTime(message.sentAt)}</p>
                ) : null}
                {message.status === "MODERATION_FAILED" ? (
                  <p className="mt-2 text-sm text-petal">
                    다음 검사: {formatDateTime(message.moderationNextRetryAt)}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/messages/${message.id}`}
                  className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
                >
                  상세
                </Link>
                {["PENDING", "SENT"].includes(message.status) ? (
                  <button
                    type="button"
                    onClick={() => void copyPublicLink(message.id)}
                    disabled={linkingId === message.id}
                    className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {message.hasPublicLink ? <Copy size={16} /> : <Link2 size={16} />}
                    {linkingId === message.id ? "생성 중" : "링크 복사"}
                  </button>
                ) : null}
                {["PENDING", "MODERATION_FAILED"].includes(message.status) ? (
                  <button
                    type="button"
                    onClick={() => void cancel(message.id)}
                    className="focus-ring inline-flex items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700"
                  >
                    <XCircle size={16} />
                    취소
                  </button>
                ) : null}
                {message.status === "CANCELED" ? (
                  <button
                    type="button"
                    onClick={() => void deleteFromMailbox(message.id)}
                    disabled={deletingId === message.id}
                    className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                    {deletingId === message.id ? "삭제 중" : "삭제"}
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
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
