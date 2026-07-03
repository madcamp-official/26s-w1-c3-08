"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  moderationNextRetryAt?: string | null;
};

export default function MessageDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [message, setMessage] = useState<MessageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

    void load();
  }, [params.id, router]);

  return (
    <AppShell>
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
          <div className="mt-8 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 leading-7 text-slate-800">
            {message.content}
          </div>
        </article>
      ) : null}
    </AppShell>
  );
}
