"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArchiveRestore, Inbox, RefreshCw, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { ApiError, apiFetch } from "@/lib/api";
import { emotionLabel, formatDateTime } from "@/lib/format";

type ArchivedMessage = {
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

export default function ArchivePage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ArchivedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [emotionFilter, setEmotionFilter] = useState("ALL");
  const [notice, setNotice] = useState<{ title: string; tone?: "success" | "danger" | "default" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<{ messages: ArchivedMessage[] }>("/messages/archived");
      setMessages(response.messages);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }

      setError(caught instanceof Error ? caught.message : "아카이브를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  async function unarchive(id: string) {
    setNotice(null);

    try {
      await apiFetch(`/messages/${id}/unarchive`, { method: "PATCH" });
      setNotice({ title: "받은 마음으로 되돌렸어요.", tone: "success" });
      await load();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "되돌리지 못했어요.",
        tone: "danger",
      });
    }
  }

  async function deleteMessage(id: string) {
    setNotice(null);

    try {
      await apiFetch(`/messages/${id}`, { method: "DELETE" });
      setNotice({ title: "아카이브에서 삭제했어요.", tone: "success" });
      await load();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "삭제하지 못했어요.",
        tone: "danger",
      });
    }
  }

  async function bulkDelete() {
    if (filteredMessages.length === 0 || !window.confirm("현재 보이는 아카이브 마음을 모두 삭제할까요?")) {
      return;
    }

    setBulkDeleting(true);
    setNotice(null);

    try {
      const response = await apiFetch<{ deletedCount: number; failedCount: number }>("/messages/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ messageIds: filteredMessages.map((message) => message.id) }),
      });
      setNotice({
        title: `${response.deletedCount}개를 삭제했어요.${response.failedCount ? ` 실패 ${response.failedCount}개` : ""}`,
        tone: response.failedCount ? "default" : "success",
      });
      await load();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "일괄 삭제하지 못했어요.",
        tone: "danger",
      });
    } finally {
      setBulkDeleting(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredMessages = useMemo(() => {
    if (emotionFilter === "ALL") {
      return messages;
    }

    return messages.filter((message) => `${message.emotionTag ?? "NONE"}:${message.customEmotionTag ?? ""}` === emotionFilter);
  }, [emotionFilter, messages]);

  const emotionFilters = useMemo(() => {
    const seen = new Set<string>();

    return messages.flatMap((message) => {
      const value = `${message.emotionTag ?? "NONE"}:${message.customEmotionTag ?? ""}`;

      if (seen.has(value)) {
        return [];
      }

      seen.add(value);

      return [
        {
          value,
          label: emotionLabel(message.emotionTag, message.customEmotionTag),
        },
      ];
    });
  }, [messages]);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">아카이브</h1>
          <p className="mt-2 text-sm text-slate-600">받은 마음 중 따로 보관한 것들을 모아두었어요.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/inbox"
            className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
          >
            <Inbox size={16} />
            받은 마음
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
          >
            <RefreshCw size={16} />
            새로고침
          </button>
          <button
            type="button"
            onClick={() => void bulkDelete()}
            disabled={bulkDeleting || filteredMessages.length === 0}
            className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            <Trash2 size={16} />
            일괄 삭제
          </button>
        </div>
      </div>
      {notice ? <Notice title={notice.title} tone={notice.tone} /> : null}
      {error ? <Notice title={error} tone="danger" /> : null}
      {loading ? <p className="text-sm text-slate-600">불러오는 중</p> : null}
      {!loading && messages.length === 0 ? <Notice title="아카이브한 마음이 없어요." /> : null}
      {emotionFilters.length > 0 ? (
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEmotionFilter("ALL")}
            className={`focus-ring rounded-md border px-3 py-2 text-sm font-semibold ${
              emotionFilter === "ALL" ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            모든 감정
          </button>
          {emotionFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setEmotionFilter(filter.value)}
              className={`focus-ring rounded-md border px-3 py-2 text-sm font-semibold ${
                emotionFilter === filter.value
                  ? "border-ink bg-ink text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      ) : null}
      {!loading && messages.length > 0 && filteredMessages.length === 0 ? <Notice title="이 감정의 마음이 없어요." /> : null}
      <div className="grid gap-3">
        {filteredMessages.map((message) => (
          <article key={message.recipientId} className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <Link href={`/messages/${message.id}`} className="focus-ring block min-w-0 rounded-md hover:text-petal">
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
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void unarchive(message.id)}
                  className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
                >
                  <ArchiveRestore size={16} />
                  복구
                </button>
                <button
                  type="button"
                  onClick={() => void deleteMessage(message.id)}
                  className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
                >
                  <Trash2 size={16} />
                  삭제
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
