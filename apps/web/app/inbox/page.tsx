"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { ApiError, apiFetch } from "@/lib/api";
import { emotionLabel, formatDateTime } from "@/lib/format";

type InboxMessage = {
  id: string;
  recipientId: string;
  title: string;
  preview: string;
  emotionTag?: string | null;
  customEmotionTag?: string | null;
  senderName?: string | null;
  arrivedAt?: string | null;
  readAt?: string | null;
};

export default function InboxPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await apiFetch<{ messages: InboxMessage[] }>("/messages/received");
        setMessages(response.messages);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
          return;
        }
        setError(caught instanceof Error ? caught.message : "수신함을 불러오지 못했어요.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [router]);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">받은 마음</h1>
        <p className="mt-2 text-sm text-slate-600">나에게 도착한 마음을 모아두었어요.</p>
      </div>
      {error ? <Notice title={error} tone="danger" /> : null}
      {loading ? <p className="text-sm text-slate-600">불러오는 중</p> : null}
      {!loading && messages.length === 0 ? (
        <Notice title="아직 도착한 마음이 없어요." body="미래의 나에게 먼저 남겨보세요." />
      ) : null}
      <div className="grid gap-3">
        {messages.map((message) => (
          <Link
            key={message.recipientId}
            href={`/messages/${message.id}`}
            className="focus-ring rounded-md border border-slate-200 bg-white p-4 hover:border-petal"
          >
            <div className="mb-2 flex flex-wrap gap-2">
              <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                {emotionLabel(message.emotionTag, message.customEmotionTag)}
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                {message.senderName ?? "누군가의 마음"}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-ink">{message.title}</h2>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{message.preview}</p>
            <p className="mt-3 text-xs font-medium text-slate-500">{formatDateTime(message.arrivedAt)}</p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
