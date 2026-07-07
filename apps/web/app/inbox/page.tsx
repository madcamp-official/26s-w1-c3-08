"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, RefreshCw, Trash2 } from "lucide-react";
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
  isSenderHidden: boolean;
  isDateHidden: boolean;
  readAt?: string | null;
  linkedAt?: string | null;
};

const readFilters = [
  { value: "ALL", label: "전체" },
  { value: "UNREAD", label: "미열람" },
  { value: "READ", label: "읽음" },
] as const;

export default function InboxPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [readFilter, setReadFilter] = useState<(typeof readFilters)[number]["value"]>("ALL");
  const [emotionFilter, setEmotionFilter] = useState("ALL");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; body?: string; tone?: "danger" | "success" | "default" } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  async function load(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setLoading(true);
    }
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
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  async function deleteFromInbox(id: string) {
    setDeletingId(id);
    setNotice(null);

    try {
      await apiFetch(`/messages/${id}`, { method: "DELETE" });
      setNotice({ title: "받은 마음에서 삭제했어요.", tone: "success" });
      await load();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "받은 마음에서 삭제하지 못했어요.",
        tone: "danger",
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function archiveMessage(id: string) {
    setNotice(null);

    try {
      await apiFetch(`/messages/${id}/archive`, { method: "PATCH" });
      setNotice({ title: "아카이브에 보관했어요.", tone: "success" });
      await load();
    } catch (caught) {
      setNotice({
        title: caught instanceof ApiError ? caught.message : "아카이브하지 못했어요.",
        tone: "danger",
      });
    }
  }

  async function bulkDeleteVisible() {
    if (filteredMessages.length === 0 || !window.confirm("현재 보이는 받은 마음을 모두 삭제할까요?")) {
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
    const timer = window.setInterval(() => {
      void load({ silent: true });
    }, 20000);

    return () => window.clearInterval(timer);
  }, [router]);

  const filteredMessages = useMemo(() => {
    let next = messages;

    if (readFilter === "UNREAD") {
      next = next.filter((message) => !message.readAt);
    } else if (readFilter === "READ") {
      next = next.filter((message) => message.readAt);
    }

    if (emotionFilter !== "ALL") {
      next = next.filter((message) => `${message.emotionTag ?? "NONE"}:${message.customEmotionTag ?? ""}` === emotionFilter);
    }

    return next;
  }, [emotionFilter, messages, readFilter]);

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
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#4E536B]">받은 마음</h1>
          <p className="mt-2 text-sm text-[#A2A6BF]">나에게 도착한 마음을 모아두었어요.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm font-semibold"
          >
            <RefreshCw size={16} />
            새로고침
          </button>
          <Link
            href="/archive"
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm font-semibold"
          >
            <Archive size={16} />
            아카이브
          </Link>
          <button
            type="button"
            onClick={() => void bulkDeleteVisible()}
            disabled={bulkDeleting || filteredMessages.length === 0}
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            <Trash2 size={16} />
            일괄 삭제
          </button>
        </div>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {readFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setReadFilter(filter.value)}
            className={`focus-ring rounded-lg border px-3 py-2 text-sm font-semibold ${
              readFilter === filter.value
                ? "border-brand-accent bg-[#6D48DB] text-white"
                : "border-[#DAD4E8] bg-white text-[#6E738A]"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {emotionFilters.length > 0 ? (
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEmotionFilter("ALL")}
            className={`focus-ring rounded-lg border px-3 py-2 text-sm font-semibold ${
              emotionFilter === "ALL" ? "border-brand-accent bg-[#6D48DB] text-white" : "border-[#DAD4E8] bg-white text-[#6E738A]"
            }`}
          >
            모든 감정
          </button>
          {emotionFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setEmotionFilter(filter.value)}
              className={`focus-ring rounded-lg border px-3 py-2 text-sm font-semibold ${
                emotionFilter === filter.value
                  ? "border-brand-accent bg-[#6D48DB] text-white"
                  : "border-[#DAD4E8] bg-white text-[#6E738A]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      ) : null}
      {notice ? <Notice title={notice.title} body={notice.body} tone={notice.tone} /> : null}
      {error ? <Notice title={error} tone="danger" /> : null}
      {loading ? <p className="text-sm text-[#A2A6BF]">불러오는 중</p> : null}
      {!loading && messages.length === 0 ? (
        <Notice title="아직 도착한 마음이 없어요." body="미래의 나에게 먼저 남겨보세요." />
      ) : null}
      {!loading && messages.length > 0 && filteredMessages.length === 0 ? (
        <Notice title="이 조건의 마음이 없어요." />
      ) : null}
      <div className="grid gap-3">
        {filteredMessages.map((message) => (
          <article key={message.recipientId} className="rounded-lg border figma-panel p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <Link href={`/messages/${message.id}`} className="focus-ring block min-w-0 rounded-lg hover:text-brand-accent">
                <div className="mb-2 flex flex-wrap gap-2">
                  <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                    {emotionLabel(message.emotionTag, message.customEmotionTag)}
                  </span>
                  <span className="rounded-lg bg-brand-gray px-2 py-1 text-xs font-semibold text-[#6E738A]">
                    {message.senderName ?? "누군가의 마음"}
                  </span>
                  <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                    {message.readAt ? "읽음" : "미열람"}
                  </span>
                  {message.linkedAt ? (
                    <span className="rounded-lg bg-brand-sub/10 px-2 py-1 text-xs font-semibold text-brand-sub">
                      자동 보관
                    </span>
                  ) : null}
                  {message.isSenderHidden ? (
                    <span className="rounded-lg bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-800">
                      발신인 숨김
                    </span>
                  ) : null}
                  {message.isDateHidden ? (
                    <span className="rounded-lg bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">
                      도착일 숨김
                    </span>
                  ) : null}
                </div>
                <h2 className="text-lg font-semibold text-[#4E536B]">{message.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-[#A2A6BF]">{message.preview}</p>
                <p className="mt-3 text-xs font-medium text-[#A2A6BF]">{formatDateTime(message.arrivedAt)}</p>
              </Link>
	              <div className="flex shrink-0 flex-wrap gap-2">
	                <button
	                  type="button"
	                  onClick={() => void archiveMessage(message.id)}
	                  className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm font-semibold text-[#6E738A]"
	                >
	                  <Archive size={16} />
	                  보관
	                </button>
	                <button
	                  type="button"
	                  onClick={() => void deleteFromInbox(message.id)}
	                  disabled={deletingId === message.id}
	                  className="focus-ring inline-flex w-fit items-center gap-2 rounded-lg border border-[#DAD4E8] px-3 py-2 text-sm font-semibold text-[#6E738A] disabled:opacity-50"
	                >
	                  <Trash2 size={16} />
	                  {deletingId === message.id ? "삭제 중" : "삭제"}
	                </button>
	              </div>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
