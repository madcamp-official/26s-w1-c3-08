"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, XCircle } from "lucide-react";
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
  moderationNextRetryAt?: string | null;
  receiver?: {
    name?: string | null;
    type: string;
    deliveryStatus: string;
  } | null;
  hasPublicLink: boolean;
};

export default function SentPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadMessages() {
    setLoading(true);
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
      setLoading(false);
    }
  }

  async function cancel(id: string) {
    await apiFetch(`/messages/${id}/cancel`, { method: "PATCH" });
    await loadMessages();
  }

  useEffect(() => {
    void loadMessages();
  }, []);

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
      {error ? <Notice title={error} tone="danger" /> : null}
      {loading ? <p className="text-sm text-slate-600">불러오는 중</p> : null}
      {!loading && messages.length === 0 ? (
        <Notice title="아직 보낸 마음이 없어요." body="첫 마음을 남겨보세요." />
      ) : null}
      <div className="grid gap-3">
        {messages.map((message) => (
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
                </div>
                <Link href={`/messages/${message.id}`} className="focus-ring rounded-md text-lg font-semibold text-ink">
                  {message.title}
                </Link>
                <p className="mt-2 text-sm text-slate-600">
                  {message.receiver?.name ?? "수신자"} · {formatDateTime(message.scheduledAt)}
                </p>
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
              </div>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
